import { runAggregate, runMultiAggregate, combineFilters, ActiveFilters } from "./dataverseUtils";

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

export async function fetchKpis(webAPI: ComponentFramework.WebApi, f: ActiveFilters): Promise<KpiValues> {
    const base = combineFilters(f);
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
