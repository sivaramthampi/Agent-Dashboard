import { AgentRow, FilterOption } from "../types";
import { formatElapsedSince, formattedValue } from "./dataverseUtils";

export interface AgentSnapshotEntry {
    agentId: string;
    name: string;
    presence: string;
    presenceSince: string | undefined;
    isLoggedIn: boolean;
}

const OFFLINE_LABELS = new Set(["offline","Offline","signed out","Signed out","not available","Not available",""]);
const isLoggedIn = (p: string) => !OFFLINE_LABELS.has(p.trim());

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
        snapshot.push({
            agentId: id,
            name: formattedValue(e, "_msdyn_agentid_value") ?? "Unknown agent",
            presence,
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


// Fetch the set of real human agent IDs (accessmode = 0, Read-Write).
// Bot/Copilot/Virtual Agent accounts all have accessmode = 4 (Non-interactive)
// confirmed via console: every bot account in this org has accessmode=4,
// islicensed=false, and a populated applicationid — vs accessmode=0 for humans.
// This is a reliable field-based check, not name-pattern matching.
export async function fetchRealAgentIds(webAPI: ComponentFramework.WebApi): Promise<Set<string>> {
    const query =
        "?$select=systemuserid" +
        "&$filter=accessmode eq 0" +
        "&$top=1000";
    const result = await webAPI.retrieveMultipleRecords("systemuser", query);
    return new Set(result.entities.map(e => e["systemuserid"] as string));
}

export function deriveAgentRows(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): AgentRow[] {
    return snapshot
        .filter(a => a.isLoggedIn)
        .filter(a => realAgentIds.has(a.agentId)) // field-based: only accessmode=0 humans
        .map(a => ({
            id: a.agentId,
            name: a.name,
            status: a.presence,
            duration: formatElapsedSince(a.presenceSince),
        }));
}

export function deriveAgentsLoggedInCount(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): number {
    return snapshot.filter(a => a.isLoggedIn && realAgentIds.has(a.agentId)).length;
}

export interface PresenceBreakdownItem { presence: string; count: number; }

export function derivePresenceBreakdown(snapshot: AgentSnapshotEntry[], realAgentIds: Set<string>): PresenceBreakdownItem[] {
    const counts = new Map<string, number>();
    for (const a of snapshot.filter(x => x.isLoggedIn && realAgentIds.has(x.agentId))) {
        counts.set(a.presence, (counts.get(a.presence) ?? 0) + 1);
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
    performanceScore: number;    // 0-100 weighted score
}

export async function fetchAgentWrapupMetrics(
    webAPI: ComponentFramework.WebApi,
    f: import("./dataverseUtils").ActiveFilters,
    realAgentIds: Set<string>
): Promise<AgentWrapupRow[]> {
    const { combineFilters } = await import("./dataverseUtils");
    const base = combineFilters(f);
    const query = `?$top=500&$select=_msdyn_activeagentid_value,msdyn_conversationhandletimeinseconds,msdyn_conversationwrapuptimeinseconds,msdyn_customersentimentlabel&$filter=${base} and _msdyn_activeagentid_value ne null`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);

    const map = new Map<string, { name: string; handles: number[]; wrapups: number[]; sentiments: number[] }>();
    for (const e of result.entities) {
        const id = e["_msdyn_activeagentid_value"] as string;
        const name = (e["_msdyn_activeagentid_value@OData.Community.Display.V1.FormattedValue"] as string) ?? "Unknown";
        if (!map.has(id)) map.set(id, { name, handles: [], wrapups: [], sentiments: [] });
        const entry = map.get(id)!;
        const h = e["msdyn_conversationhandletimeinseconds"];
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

    // Calculate team averages for scoring
    const allRows = Array.from(map.entries())
        .filter(([id]) => realAgentIds.has(id));
    const teamAvgConvs = allRows.length > 0
        ? allRows.reduce((s, [,d]) => s + d.handles.length, 0) / allRows.length : 1;

    return allRows
        .map(([id, d]) => {
            const avgHandle = d.handles.length > 0 ? d.handles.reduce((a,b)=>a+b,0)/d.handles.length : 0;
            const totalHandle = d.handles.reduce((a,b)=>a+b,0);
            const avgWrapup = d.wrapups.length > 0 ? d.wrapups.reduce((a,b)=>a+b,0)/d.wrapups.length : 0;
            const totalWrapup = d.wrapups.reduce((a,b)=>a+b,0);
            const avgSentiment = d.sentiments.length > 0
                ? d.sentiments.reduce((a,b)=>a+b,0)/d.sentiments.length : null;

            // Scoring: weighted 0-100
            // 15% conversations, 20% handle time, 30% wrapup, 35% sentiment
            const convScore    = Math.min((d.handles.length / teamAvgConvs) * 100, 100);
            const handleScore  = Math.max(100 - Math.min(Math.abs(avgHandle - 600) / 600 * 100, 100), 0);
            const wrapupScore  = Math.max(100 - (avgWrapup / 600) * 100, 0);
            const sentScore    = avgSentiment !== null ? ((avgSentiment + 3) / 6) * 100 : 50;
            const performanceScore = Math.round(
                convScore * 0.15 + handleScore * 0.20 + wrapupScore * 0.30 + sentScore * 0.35
            );

            return {
                agentId: id,
                agentName: d.name,
                conversations: d.handles.length,
                avgHandleSec: avgHandle,
                totalHandleSec: totalHandle,
                avgWrapupSec: avgWrapup,
                totalWrapupSec: totalWrapup,
                avgSentiment,
                performanceScore: Math.min(Math.max(performanceScore, 0), 100),
            };
        })
        .sort((a, b) => b.performanceScore - a.performanceScore);
}
