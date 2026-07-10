import { AgentRow, FilterOption } from "../types";
import { formatElapsedSince, formattedValue } from "./dataverseUtils";

export interface AgentSnapshotEntry {
    agentId: string;
    agentStatusId: string | undefined;
    name: string;
    presence: string;
    presenceId: string | undefined;
    presenceSince: string | undefined;
    isLoggedIn: boolean;
}

const OFFLINE_LABELS = new Set(["offline","Offline","signed out","Signed out","not available","Not available",""]);
const isLoggedIn = (p: string) => !OFFLINE_LABELS.has(p.trim());

// Specific msdyn_agentstatus record GUIDs (msdyn_agentstatusid — the status
// record's own primary key, NOT the agent/systemuser ID) to exclude from the
// Agent List entirely, regardless of presence/status. Compared case-insensitively.
const EXCLUDED_AGENT_STATUS_IDS = new Set([
    "44b5aada-f6a0-ef11-8a6a-000d3a370ec3",
    "5232ce36-2fd5-ef11-8eea-00224806ccec",
    "c0428915-f7a0-ef11-8a6a-00224806fb06",
    "aef48527-01a1-ef11-8a6a-6045bd049ba5",
    "77e7e1c6-b2df-4859-bc4b-732d4ede5309",
    "daf5270e-f72c-46c7-b663-dfc13def019c",
    "dd043dff-f307-4c68-b885-f6edc5525bab",
    "f2a0fc91-bce0-4fb1-af6f-fe58b9e962b9",
]);
const isExcludedAgentStatus = (agentStatusId: string | undefined) =>
    !!agentStatusId && EXCLUDED_AGENT_STATUS_IDS.has(agentStatusId.toLowerCase());

// The msdyn_presence table has 20+ records (break, lunch, meeting, coaching,
// training, various DND sub-states, etc.) — most of which roll up to a
// "Busy" or "Busy - DND" base status but aren't the primary states we track.
// These 5 are the static/always-shown tiles, keyed by msdyn_presence GUID
// (not display text) since several presence records share the same or very
// similar display names. Any other presence an agent is actually in still
// shows up — just as a dynamic tile using its own raw display text, added
// only when at least one agent is currently in that status.
export const CANONICAL_PRESENCE_BY_ID: Record<string, string> = {
    "f523f628-c07a-e811-8162-000d3aa11f50": "Available",
    "efdeb843-c07a-e811-8162-000d3aa11f50": "Busy",
    "08971864-c07a-e811-8162-000d3aa11f50": "BusyDND",
    "57900534-228c-ed11-81ac-6045bd019179": "Project",
    "3dacae76-c07a-e811-8162-000d3aa11f50": "Away",
};

export async function fetchAgentSnapshot(webAPI: ComponentFramework.WebApi): Promise<AgentSnapshotEntry[]> {
    const query =
        "?$top=500" +
        "&$select=msdyn_agentstatusid,_msdyn_agentid_value,_msdyn_currentpresenceid_value,msdyn_presencemodifiedon" +
        "&$orderby=msdyn_presencemodifiedon desc";
    const result = await webAPI.retrieveMultipleRecords("msdyn_agentstatus", query);
    const seen = new Set<string>();
    const snapshot: AgentSnapshotEntry[] = [];
    for (const e of result.entities) {
        const id = e["_msdyn_agentid_value"] as string | undefined;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const presence = formattedValue(e, "_msdyn_currentpresenceid_value") ?? "";
        const presenceId = (e["_msdyn_currentpresenceid_value"] as string | undefined)?.toLowerCase();
        snapshot.push({
            agentId: id,
            agentStatusId: e["msdyn_agentstatusid"] as string | undefined,
            name: formattedValue(e, "_msdyn_agentid_value") ?? "Unknown agent",
            presence,
            presenceId,
            presenceSince: e["msdyn_presencemodifiedon"] as string | undefined,
            isLoggedIn: isLoggedIn(presence),
        });
    }
    return snapshot;
}

// Fetch active agents from systemuser (mirrors PBIX query exactly):
//   - has a positionid (filters out system/non-agent users)
//   - isdisabled = false
// Names excluded to match PBIX filter (internal/system accounts)
const EXCLUDED_AGENT_NAMES = new Set([
    "Ramesh Ramakrishnan", "Nihad Chollapra", "Ajay Joseph",
    "Akhil Ashok", "Shameena Abdul", "Rakesh Anand"
]);

export async function fetchAgentOptions(webAPI: ComponentFramework.WebApi): Promise<FilterOption[]> {
    // positionid is a lookup — returned as _positionid_value by Dataverse
    // accessmode eq 0 = real human agents (bots/Copilot are accessmode 4, Non-interactive)
    const query =
        "?$select=systemuserid,fullname,isdisabled,_positionid_value,accessmode" +
        "&$filter=isdisabled eq false and _positionid_value ne null and accessmode eq 0" +
        "&$orderby=fullname asc" +
        "&$top=500";
    const result = await webAPI.retrieveMultipleRecords("systemuser", query);
    return result.entities
        .filter(e => !EXCLUDED_AGENT_NAMES.has(e["fullname"] as string))
        .map(e => ({
            key: e["systemuserid"] as string,
            label: (e["fullname"] as string) ?? "Unknown",
        }));
}


// Fetch the set of agent IDs to include (accessmode != 4, Non-interactive).
// Bot/Copilot/Virtual Agent accounts are accessmode 4 (Non-interactive) —
// this excludes only those, and now includes Read-Write(0), Administrative(1),
// Read(2), Support User(3), and Delegated Admin(5).
export async function fetchRealAgentIds(webAPI: ComponentFramework.WebApi): Promise<Set<string>> {
    const query =
        "?$select=systemuserid" +
        "&$filter=accessmode ne 4" +
        "&$top=1000";
    const result = await webAPI.retrieveMultipleRecords("systemuser", query);
    return new Set(result.entities.map(e => e["systemuserid"] as string));
}

// Filters: isLoggedIn (presence text not in {offline, signed out, not
// available, ""}) and not one of the explicitly excluded agent GUIDs.
// realAgentIds param kept for call-site compatibility but not applied.
export function deriveAgentRows(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): AgentRow[] {
    return snapshot
        .filter(a => a.isLoggedIn)
        .filter(a => !isExcludedAgentStatus(a.agentStatusId))
        .map(a => ({
            id: a.agentId,
            name: a.name,
            // Canonical label if this GUID is one of the 5 tracked statuses,
            // otherwise fall back to the raw presence text so "other" statuses
            // still show up (as their own dynamic tile in the UI).
            status: (a.presenceId && CANONICAL_PRESENCE_BY_ID[a.presenceId]) ?? a.presence,
            duration: formatElapsedSince(a.presenceSince),
        }));
}

export function deriveAgentsLoggedInCount(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): number {
    return snapshot.filter(a => a.isLoggedIn && !isExcludedAgentStatus(a.agentStatusId)).length;
}

export interface PresenceBreakdownItem { presence: string; count: number; }

export function derivePresenceBreakdown(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): PresenceBreakdownItem[] {
    const counts = new Map<string, number>();
    for (const a of snapshot.filter(x => x.isLoggedIn && !isExcludedAgentStatus(x.agentStatusId))) {
        const label = (a.presenceId && CANONICAL_PRESENCE_BY_ID[a.presenceId]) ?? a.presence;
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([presence, count]) => ({ presence, count }));
}

export interface AgentWrapupRow {
    agentId: string;
    agentName: string;
    conversations: number;
    avgHandleSec: number;
    totalHandleSec: number;
    avgWrapupSec: number;
    totalWrapupSec: number;
    avgSentiment: number | null; // weighted avg -3 to +3, null if no sentiment data
}

export async function fetchAgentWrapupMetrics(
    webAPI: ComponentFramework.WebApi,
    f: import("./dataverseUtils").ActiveFilters,
    realAgentIds: Set<string>
): Promise<AgentWrapupRow[]> {
    const { combineFilters } = await import("./dataverseUtils");
    const base = combineFilters(f);
    // NOTE: handle time now mirrors the KPI tile's conversation/session split:
    //   - msdyn_isagentsession eq false (conversation record) → msdyn_conversationhandletimeinseconds
    //   - msdyn_isagentsession eq true  (session record)      → talk + active wrap-up + hold
    // These are raw per-record fields (not aggregates), so the sum below is exact per record —
    // no denominator-mismatch caveat like the KPI tile's runMultiAggregate approach.
    const query = `?$top=500&$select=_msdyn_activeagentid_value,msdyn_isagentsession,msdyn_conversationhandletimeinseconds,msdyn_conversationtalktimeinseconds,msdyn_conversationactivewrapuptimeinseconds,msdyn_conversationholdtimeinseconds,msdyn_conversationwrapuptimeinseconds,msdyn_customersentimentlabel&$filter=${base} and _msdyn_activeagentid_value ne null`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);

    const map = new Map<string, { name: string; handles: number[]; wrapups: number[]; sentiments: number[] }>();
    for (const e of result.entities) {
        const id = e["_msdyn_activeagentid_value"] as string;
        const name = (e["_msdyn_activeagentid_value@OData.Community.Display.V1.FormattedValue"] as string) ?? "Unknown";
        if (!map.has(id)) map.set(id, { name, handles: [], wrapups: [], sentiments: [] });
        const entry = map.get(id)!;

        const isSession = e["msdyn_isagentsession"] === true;
        let h: unknown;
        if (isSession) {
            const talk = e["msdyn_conversationtalktimeinseconds"];
            const wrap = e["msdyn_conversationactivewrapuptimeinseconds"];
            const hold = e["msdyn_conversationholdtimeinseconds"];
            // Only sum if at least one component is a real number; treat missing components as 0
            // rather than dropping the whole record (a session with no hold time is still valid).
            if (typeof talk === "number" || typeof wrap === "number" || typeof hold === "number") {
                h = (typeof talk === "number" ? talk : 0)
                  + (typeof wrap === "number" ? wrap : 0)
                  + (typeof hold === "number" ? hold : 0);
            }
        } else {
            h = e["msdyn_conversationhandletimeinseconds"];
        }
        const w = e["msdyn_conversationwrapuptimeinseconds"];
        if (typeof h === "number") entry.handles.push(h);
        if (typeof w === "number") entry.wrapups.push(w);
        // Sentiment: map choice value to -3/+3 weight
        const sv = e["msdyn_customersentimentlabel"] as number | undefined;
        const sentWeight: Record<number,number> = {7:-3,8:-2,9:-1,10:0,11:1,12:2,13:3};
        if (sv !== undefined && sv !== null && sv !== 0 && sentWeight[sv] !== undefined) {
            entry.sentiments.push(sentWeight[sv]);
        }
    }

    const allRows = Array.from(map.entries())
        .filter(([id]) => realAgentIds.has(id));

    return allRows
        .map(([id, d]) => {
            const avgHandle = d.handles.length > 0 ? d.handles.reduce((a,b)=>a+b,0)/d.handles.length : 0;
            const totalHandle = d.handles.reduce((a,b)=>a+b,0);
            const avgWrapup = d.wrapups.length > 0 ? d.wrapups.reduce((a,b)=>a+b,0)/d.wrapups.length : 0;
            const totalWrapup = d.wrapups.reduce((a,b)=>a+b,0);
            const avgSentiment = d.sentiments.length > 0
                ? d.sentiments.reduce((a,b)=>a+b,0)/d.sentiments.length : null;

            return {
                agentId: id,
                agentName: d.name,
                conversations: d.handles.length,
                avgHandleSec: avgHandle,
                totalHandleSec: totalHandle,
                avgWrapupSec: avgWrapup,
                totalWrapupSec: totalWrapup,
                avgSentiment,
            };
        })
        .sort((a, b) => a.avgWrapupSec - b.avgWrapupSec);
}
