import { runAggregate, runMultiAggregate, combineFilters, ActiveFilters, isChannelFilterActive, shouldIncludeChannel } from "./dataverseUtils";

export interface KpiValues {
    total: number; incoming: number; outgoing: number;
    inQueue: number; engaged: number; abandonedRatePct: number;
    avgSpeedToAnswerMs: number; avgHandleTimeConversationSec: number;
    avgHandleTimeSessionSec: number; longestWaitSec: number; transferRatePct: number;
}

const E = "msdyn_ocliveworkitem";

// Session handle time = talk time + active wrap-up time + hold time, filtered to session records.
// Conversation handle time = msdyn_conversationhandletimeinseconds averaged over ALL records in
// scope (no msdyn_isagentsession filter) — that filter was returning 0/empty in this org's data,
// so it's been removed per request.
const SESSION_HANDLE_TIME_COMPONENTS = [
    { field: "msdyn_conversationtalktimeinseconds",         op: "average" as const, alias: "avgTalk" },
    { field: "msdyn_conversationactivewrapuptimeinseconds", op: "average" as const, alias: "avgWrap" },
    { field: "msdyn_conversationholdtimeinseconds",         op: "average" as const, alias: "avgHold" },
];

// Fields needed to compute every KPI client-side. Only used when a channel
// subset is selected — see fetchKpis below for why the aggregate endpoints
// can't be used in that case (channel is a client-side-only filter).
const CLIENT_SIDE_SELECT = [
    "msdyn_ocliveworkitemid", "msdyn_isoutbound", "statecode", "_msdyn_activeagentid_value",
    "msdyn_isabandoned", "msdyn_firstresponsetimeinmsadjforoh", "msdyn_conversationhandletimeinseconds",
    "msdyn_conversationfirstwaittimeinseconds", "msdyn_transfercount", "msdyn_channel",
    "msdyn_isagentsession", "msdyn_conversationtalktimeinseconds",
    "msdyn_conversationactivewrapuptimeinseconds", "msdyn_conversationholdtimeinseconds",
].join(",");

function average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

// Client-side reduction path — same shape of output as the aggregate path below,
// but computed in JS over raw records so shouldIncludeChannel() can actually be
// applied. $top=5000 mirrors the same trade-off trend.ts/statusBreakdown.ts already
// make; if a single day's volume regularly exceeds this, switch to paging.
async function fetchKpisClientSide(webAPI: ComponentFramework.WebApi, f: ActiveFilters, base: string): Promise<KpiValues> {
    const channelKeys = f.channelKeys ?? new Set<string>();
    const query = `?$top=5000&$select=${CLIENT_SIDE_SELECT}&$filter=${base}`;
    const result = await webAPI.retrieveMultipleRecords(E, query);

    let total = 0, incoming = 0, outgoing = 0, inQueue = 0, engaged = 0, abandoned = 0, transferred = 0;
    let longestWaitSec = 0;
    const speedToAnswer: number[] = [];
    const handleTimeConv: number[] = [];
    const talk: number[] = [], wrap: number[] = [], hold: number[] = [];

    for (const e of result.entities) {
        const chLabel = e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
        if (!shouldIncludeChannel(chLabel, channelKeys)) continue;

        total++;
        if (e["msdyn_isoutbound"]) outgoing++; else incoming++;

        const hasAgent = e["_msdyn_activeagentid_value"] != null;
        if (e["statecode"] === 0 && !hasAgent) inQueue++;
        if (e["statecode"] === 0 && hasAgent) engaged++;

        if (e["msdyn_isabandoned"] === true) abandoned++;
        if (typeof e["msdyn_transfercount"] === "number" && (e["msdyn_transfercount"] as number) > 0) transferred++;

        const speed = e["msdyn_firstresponsetimeinmsadjforoh"];
        if (typeof speed === "number") speedToAnswer.push(speed);

        const handle = e["msdyn_conversationhandletimeinseconds"];
        if (typeof handle === "number") handleTimeConv.push(handle);

        const wait = e["msdyn_conversationfirstwaittimeinseconds"];
        if (typeof wait === "number" && wait > longestWaitSec) longestWaitSec = wait;

        if (e["msdyn_isagentsession"] === true) {
            const t = e["msdyn_conversationtalktimeinseconds"];
            const w = e["msdyn_conversationactivewrapuptimeinseconds"];
            const h = e["msdyn_conversationholdtimeinseconds"];
            if (typeof t === "number") talk.push(t);
            if (typeof w === "number") wrap.push(w);
            if (typeof h === "number") hold.push(h);
        }
    }

    return {
        total, incoming, outgoing, inQueue, engaged,
        abandonedRatePct: total > 0 ? (abandoned / total) * 100 : 0,
        avgSpeedToAnswerMs: average(speedToAnswer),
        avgHandleTimeConversationSec: average(handleTimeConv),
        avgHandleTimeSessionSec: average(talk) + average(wrap) + average(hold),
        longestWaitSec,
        transferRatePct: total > 0 ? (transferred / total) * 100 : 0,
    };
}

export async function fetchKpis(webAPI: ComponentFramework.WebApi, f: ActiveFilters): Promise<KpiValues> {
    const base = combineFilters(f);

    // Channel can only be filtered client-side (see shouldIncludeChannel / MDL note
    // in dataverseUtils.ts). When no channel subset is active, every record in scope
    // counts anyway, so the cheap server-side aggregate queries below give an
    // identical result for a fraction of the payload. Only fall back to pulling and
    // reducing raw records when the user has actually narrowed by channel.
    if (!isChannelFilterActive(f.channelKeys)) {
        const sessionFilter = `${base} and msdyn_isagentsession eq true`;

        const [total, incoming, outgoing, inQueue, engaged, abandonedCount,
            avgSpeedToAnswerMs, avgHandleTimeConvSec, sessionComponents,
            longestWaitSec, transferredCount] = await Promise.all([
            runAggregate(webAPI, E, base, undefined, "count"),
            runAggregate(webAPI, E, `${base} and msdyn_isoutbound eq false`, undefined, "count"),
            runAggregate(webAPI, E, `${base} and msdyn_isoutbound eq true`, undefined, "count"),
            runAggregate(webAPI, E, `${base} and statecode eq 0 and _msdyn_activeagentid_value eq null`, undefined, "count"),
            runAggregate(webAPI, E, `${base} and statecode eq 0 and _msdyn_activeagentid_value ne null`, undefined, "count"),
            runAggregate(webAPI, E, `${base} and msdyn_isabandoned eq true`, undefined, "count"),
            runAggregate(webAPI, E, base, "msdyn_firstresponsetimeinmsadjforoh", "average"),
            runAggregate(webAPI, E, base, "msdyn_conversationhandletimeinseconds", "average"),
            runMultiAggregate(webAPI, E, sessionFilter, SESSION_HANDLE_TIME_COMPONENTS),
            runAggregate(webAPI, E, base, "msdyn_conversationfirstwaittimeinseconds", "max"),
            runAggregate(webAPI, E, `${base} and msdyn_transfercount gt 0`, undefined, "count"),
        ]);

        const avgHandleTimeSessSec = sessionComponents.avgTalk + sessionComponents.avgWrap + sessionComponents.avgHold;

        return {
            total, incoming, outgoing, inQueue, engaged,
            abandonedRatePct: total > 0 ? (abandonedCount / total) * 100 : 0,
            avgSpeedToAnswerMs,
            avgHandleTimeConversationSec: avgHandleTimeConvSec,
            avgHandleTimeSessionSec: avgHandleTimeSessSec,
            longestWaitSec, transferRatePct: total > 0 ? (transferredCount / total) * 100 : 0,
        };
    }

    return fetchKpisClientSide(webAPI, f, base);
}
