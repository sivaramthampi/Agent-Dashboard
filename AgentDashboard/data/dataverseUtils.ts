export function formattedValue(entity: Record<string, unknown>, rawFieldName: string): string | undefined {
    const value = entity[`${rawFieldName}@OData.Community.Display.V1.FormattedValue`];
    return typeof value === "string" ? value : undefined;
}

export function formatElapsedSince(isoTimestamp: string | undefined): string {
    if (!isoTimestamp) return "—";
    return formatSeconds(Math.max(0, Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000)));
}

export function formatSeconds(totalSeconds: number | null | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) return "—";
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatMilliseconds(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    return formatSeconds(ms / 1000);
}

export function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return `${value.toFixed(1)}%`;
}

// Same org-timezone shift used by buildDateRangeFilter's midnight calculation, applied
// to a single record's createdon timestamp instead of "now". Use this anywhere a record
// needs to be bucketed by hour-of-day in the ORG's local time, not the browser's local
// time — e.g. yesterdayVolume.ts's peak-hour chart. Using Date.getHours() directly reads
// the browser's timezone, which silently shifts every bucket if the browser isn't in the
// org's configured timezone (this was the root cause of the "peak at midnight" bug).
export function getOrgLocalHour(dateValue: string | Date, orgTimezoneBias?: number): number {
    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (orgTimezoneBias === undefined) return d.getHours(); // fallback: browser local time
    const orgOffsetMs = orgTimezoneBias * 60 * 1000;
    const shifted = new Date(d.getTime() - orgOffsetMs);
    return shifted.getUTCHours();
}

// ── Yesterday-comparison delta formatting ─────────────────────────────────────
// For counts/durations: relative % change. For values that are ALREADY a
// percentage (abandon rate, transfer rate), a relative % change of a % is
// confusing (4%→5% reads as "+25%" which overstates a 1-point move), so those
// use percentage-POINT delta instead — see formatDeltaPP.
export function formatDeltaPct(current: number | null | undefined, previous: number | null | undefined): string | undefined {
    if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
    if (!previous) return undefined; // avoid divide-by-zero / meaningless "+Infinity%" vs a zero baseline
    const pct = ((current - previous) / previous) * 100;
    const rounded = Number(pct.toFixed(1));
    const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "→";
    const sign = rounded > 0 ? "+" : "";
    return `${arrow} ${sign}${rounded}% vs yesterday`;
}

export function formatDeltaPP(current: number | null | undefined, previous: number | null | undefined): string | undefined {
    if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
    const pp = current - previous;
    const rounded = Number(pp.toFixed(1));
    const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "→";
    const sign = rounded > 0 ? "+" : "";
    return `${arrow} ${sign}${rounded}pp vs yesterday`;
}

// ── Confirmed field facts (verified via console 2026-06-24) ──────────────────
// msdyn_channel   : Choice field (Edm.Int32 option-set) — NOT null. 
//                   Value 192340000 = "Entity Records" channel (non-human).
//                   Must be compared as integer: msdyn_channel ne 192340000
//                   NOTE: the earlier Edm.String error was caused by the MDL
//                   layer intercepting the query — direct WebAPI calls work fine.
// _msdyn_cdsqueueid_value : Guid lookup for queue (display via FormattedValue)
// _msdyn_currentpresenceid_value : Guid lookup, FormattedValue = lowercase label

export const BOT_AGENT_NAMES = [
    "Virtual Agent Dyn-CS-Omnichannel-Voice-IVR-BOT-Prod",
    "Virtual Agent Dyn-CS-Omnichannel-Voice-IVR-BOT-2.0-Prod",
    "Copilot CR-CS-CanyonRanch IVR Bot 3.0 (Microsoft Copilot Studio)",
];

// Pattern-based bot exclusion — catches all Copilot/bot variants by name pattern
export const BOT_NAME_PATTERNS = [
    "copilot",
    "virtual agent",
    "ivr bot",
    "microsoft copilot studio",
];

export function isBotAgent(name: string): boolean {
    const lower = name.toLowerCase();
    if (BOT_AGENT_NAMES.some(n => n.toLowerCase() === lower)) return true;
    return BOT_NAME_PATTERNS.some(p => lower.includes(p));
}

export const EXCLUDED_QUEUE_NAME_PATTERNS = ["practice", "demo"];

// Entity Records channel value — non-human channel, excluded from all queries (matches PBIX)
export const ENTITY_RECORDS_CHANNEL = 192340000;

// PCF MDL layer blocks ALL integer comparisons on msdyn_channel (Edm.String vs Edm.Int32).
// Channel filter is applied CLIENT-SIDE using the FormattedValue label.
// Keys match the option keys in the channel filter dropdown in App.tsx.
// Confirmed org value: 192440000 = "Voice call"
export const CHANNEL_LABEL_MAP: Record<string, string> = {
    voice: "voice call",   // 192440000 in this org
    sms:   "sms",
    chat:  "chat",
    email: "email",
};

// Server-side channel filter is disabled — always returns "" to avoid MDL type errors.
// Actual filtering happens in each data file using shouldIncludeChannel().
export function buildChannelFilter(_selectedChannelKeys: Set<string>): string {
    return "";
}

// True only when a genuine SUBSET of channels is selected (not all, not none —
// both of those mean "no filter" per shouldIncludeChannel's own rule). Lets a
// caller choose between a cheap server-side aggregate query (no filter active)
// and a client-side reduction over raw records (filter active, since channel
// can't be filtered server-side — see shouldIncludeChannel above).
export function isChannelFilterActive(selectedChannelKeys: Set<string> | undefined): boolean {
    if (!selectedChannelKeys) return false;
    const allKeys = Object.keys(CHANNEL_LABEL_MAP);
    return selectedChannelKeys.size > 0 && selectedChannelKeys.size < allKeys.length;
}

// Use this in data files to apply channel filter client-side.
// Pass e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as channelLabel.
export function shouldIncludeChannel(
    channelLabel: string | undefined,
    selectedChannelKeys: Set<string>
): boolean {
    // No filter active (all selected or none selected) — include all
    const allKeys = Object.keys(CHANNEL_LABEL_MAP);
    if (selectedChannelKeys.size === 0 || selectedChannelKeys.size === allKeys.length) return true;

    // Empty/null label = voice call (FormattedValue not returned for this channel in org)
    // Map it to "voice" for filter matching
    const labelLower = (channelLabel ?? "").toLowerCase().trim();
    const effectiveLabel = labelLower === "" ? "voice call" : labelLower;

    for (const key of selectedChannelKeys) {
        const mapped = CHANNEL_LABEL_MAP[key];
        if (mapped && effectiveLabel.includes(mapped)) return true;
    }
    return false;
}

// Build OData $filter fragment for selected queue GUIDs.
// NOTE: PCF MDL layer does NOT support the OData `in` operator ("The query node In is not supported").
// We use multiple `eq` conditions joined with `or` instead.
export function buildQueueFilter(selectedQueueKeys: Set<string>, allQueueKeys: Set<string>): string {
    if (selectedQueueKeys.size === 0 || selectedQueueKeys.size === allQueueKeys.size) return "";
    const conditions = Array.from(selectedQueueKeys)
        .map(g => `_msdyn_cdsqueueid_value eq ${g}`)
        .join(" or ");
    // Wrap in parens if more than one condition so it combines correctly with `and`
    return selectedQueueKeys.size === 1 ? conditions : `(${conditions})`;
}

// Build OData $filter for selected agent GUIDs.
export function buildAgentFilter(selectedAgentKeys: Set<string>): string {
    if (selectedAgentKeys.size === 0) return "";
    if (selectedAgentKeys.size === 1) {
        return `_msdyn_activeagentid_value eq ${Array.from(selectedAgentKeys)[0]}`;
    }
    return `(${Array.from(selectedAgentKeys).map(g => `_msdyn_activeagentid_value eq ${g}`).join(" or ")})`;
}

// Combine all active filters into a single OData fragment (empty string = no filter).
export interface ActiveFilters {
    dateFilter: string;
    queueFilter: string;     // from buildQueueFilter
    channelFilter: string;   // always "" — channel filter is client-side only
    channelKeys?: Set<string>; // selected channel keys for client-side filtering
    agentFilter: string;     // from buildAgentFilter
}

export function combineFilters(f: ActiveFilters): string {
    return [f.dateFilter, f.queueFilter, f.channelFilter, f.agentFilter]
        .filter(Boolean)
        .join(" and ");
}

// ── Date range filter ─────────────────────────────────────────────────────────
// orgTimezoneBias: value from usersettings.timezonebias (minutes, positive = behind UTC)
// e.g. US Central = 360, IST = -330, UTC = 0
// Pass undefined to fall back to browser local time (legacy behaviour).
export function buildDateRangeFilter(
    timeKey: string,
    orgTimezoneBias?: number
): { filter: string; from: Date; to: Date } {
    const now = new Date();

    // Calculate midnight in the org timezone.
    // timezonebias is the number of minutes to SUBTRACT from UTC to get local time.
    // e.g. CST bias=360 → local = UTC - 360 min → midnight local = UTC midnight + 360 min
    let startOfToday: Date;
    if (orgTimezoneBias !== undefined) {
        // Current time in org's local time as a UTC-shifted value
        const orgOffsetMs = orgTimezoneBias * 60 * 1000; // bias in ms (positive = behind UTC)
        const nowInOrg = new Date(now.getTime() - orgOffsetMs); // shift now to org local
        // Midnight in org local time
        const midnightOrg = new Date(Date.UTC(
            nowInOrg.getUTCFullYear(),
            nowInOrg.getUTCMonth(),
            nowInOrg.getUTCDate(),
            0, 0, 0, 0
        ));
        // Shift back to UTC
        startOfToday = new Date(midnightOrg.getTime() + orgOffsetMs);
    } else {
        // Fallback: browser local midnight
        startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    let from: Date;
    let to: Date = now;

    switch (timeKey) {
        case "yesterday": {
            from = new Date(startOfToday);
            from.setUTCDate(from.getUTCDate() - 1);
            to = new Date(startOfToday);
            break;
        }
        case "yesterdaySamePeriod": {
            // Same elapsed window as "today so far", shifted back exactly 24h —
            // e.g. if it's currently 2:00pm, this returns yesterday 12:00am–2:00pm,
            // so the KPI comparison is apples-to-apples rather than partial-day vs full-day.
            const elapsedMs = now.getTime() - startOfToday.getTime();
            from = new Date(startOfToday);
            from.setUTCDate(from.getUTCDate() - 1);
            to = new Date(from.getTime() + elapsedMs);
            break;
        }
        case "last2days": {
            from = new Date(startOfToday);
            from.setUTCDate(from.getUTCDate() - 2);
            break;
        }
        default: { // "today"
            from = startOfToday;
            break;
        }
    }

    const filter = `createdon ge ${from.toISOString()} and createdon le ${to.toISOString()}`;

    console.log(
        `%c[AgentDashboard] Time filter`,
        'background:#1D4ED8;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
        '\n  Key       :', timeKey,
        '\n  Org bias  :', orgTimezoneBias !== undefined ? orgTimezoneBias + ' min' : 'using browser tz',
        '\n  From (UTC):', from.toISOString(),
        '\n  To   (UTC):', to.toISOString(),
        '\n  OData     :', filter
    );

    return { filter, from, to };
}

type AggregateOp = "count" | "average" | "max" | "sum";

export async function runAggregate(
    webAPI: ComponentFramework.WebApi,
    entityLogicalName: string,
    filter: string | undefined,
    field: string | undefined,
    op: AggregateOp
): Promise<number> {
    const aggExpr = op === "count" ? "aggregate($count as result)" : `aggregate(${field} with ${op} as result)`;

    // PCF MDL layer rejects both `in` and `or` inside $apply=filter(...).
    // Workaround: use $filter= as a separate query parameter alongside $apply.
    // ?$filter=<conditions>&$apply=aggregate(...) works in Dataverse WebAPI
    // and bypasses the MDL $apply filter() parser restriction.
    let qs: string;
    if (filter) {
        qs = `?$filter=${filter}&$apply=${aggExpr}`;
    } else {
        qs = `?$apply=${aggExpr}`;
    }

    const result = await webAPI.retrieveMultipleRecords(entityLogicalName, qs);
    const row = result.entities[0] as Record<string, unknown> | undefined;
    const value = row?.["result"];
    return typeof value === "number" ? value : 0;
}

// Run several named aggregates in ONE Dataverse round-trip instead of one call per field.
// e.g. runMultiAggregate(webAPI, E, filter, [
//        { field: "msdyn_conversationtalktimeinseconds", op: "average", alias: "avgTalk" },
//        { field: "msdyn_conversationactivewrapuptimeinseconds", op: "average", alias: "avgWrap" },
//        { field: "msdyn_conversationholdtimeinseconds", op: "average", alias: "avgHold" },
//      ])
// NOTE: each named average is computed independently over non-null values for THAT field
// (standard OData aggregate behaviour). If talk/wrap/hold are populated inconsistently across
// records (e.g. hold time null on some sessions but talk time present), the three averages are
// each over a slightly different denominator, so summing them is an approximation of the true
// per-session average — not mathematically identical to averaging (talk+wrap+hold) per record.
// Acceptable for a supervisor dashboard; flag if exact per-record precision is required.
export async function runMultiAggregate(
    webAPI: ComponentFramework.WebApi,
    entityLogicalName: string,
    filter: string | undefined,
    aggregates: { field: string; op: Exclude<AggregateOp, "count">; alias: string }[]
): Promise<Record<string, number>> {
    const aggExpr = `aggregate(${aggregates.map(a => `${a.field} with ${a.op} as ${a.alias}`).join(",")})`;
    const qs = filter ? `?$filter=${filter}&$apply=${aggExpr}` : `?$apply=${aggExpr}`;

    const result = await webAPI.retrieveMultipleRecords(entityLogicalName, qs);
    const row = result.entities[0] as Record<string, unknown> | undefined;

    const out: Record<string, number> = {};
    for (const a of aggregates) {
        const v = row?.[a.alias];
        out[a.alias] = typeof v === "number" ? v : 0;
    }
    return out;
}
