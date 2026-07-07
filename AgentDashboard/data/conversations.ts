import { ConversationRow } from "../types";
import {
    formattedValue, formatElapsedSince,
    isBotAgent, EXCLUDED_QUEUE_NAME_PATTERNS, ENTITY_RECORDS_CHANNEL,
    combineFilters, ActiveFilters, shouldIncludeChannel
} from "./dataverseUtils";

const SELECT = [
    "msdyn_ocliveworkitemid", "msdyn_isoutbound", "modifiedon", "statuscode",
    "_msdyn_customer_value", "_msdyn_activeagentid_value", "_msdyn_cdsqueueid_value",
    "msdyn_channel"
].join(","); // fetched for client-side entity records exclusion

export async function fetchOngoingConversations(
    webAPI: ComponentFramework.WebApi,
    f: ActiveFilters
): Promise<ConversationRow[]> {
    // Conversations table always scopes to open records (statecode eq 0).
    // Date filter is replaced — we show live open conversations, not historical.
    // Channel 192340000 (Entity Records) excluded client-side.
    // PCF MDL layer blocks ALL integer comparisons on msdyn_channel — cannot filter server-side.
    const dateScope = f.dateFilter ? `${f.dateFilter} and statecode eq 0` : "statecode eq 0";
    const baseFilter = combineFilters({ ...f, dateFilter: dateScope });

    // Encode the filter to ensure PCF MDL layer passes `or` conditions correctly
    const query = `?$top=50&$select=${SELECT}&$filter=${baseFilter}&$orderby=modifiedon desc`;
    console.log("%c[AD Conv Filter]","background:#059669;color:#fff;padding:2px 6px;border-radius:3px","filter:", baseFilter);
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);

    
    return result.entities
        .filter(e => {
            // Bot exclusion — matches PBIX named bot filter
            const agent = (formattedValue(e, "_msdyn_activeagentid_value") ?? "").toLowerCase();
            if (isBotAgent(agent)) return false;

            // Queue exclusion — matches PBIX:
            //   not Contains "practice"
            //   not Contains "demo"
            //   not StartsWith "<"   ← added to match PBIX
            const q = formattedValue(e, "_msdyn_cdsqueueid_value") ?? "";
            const qLower = q.toLowerCase();
            if (EXCLUDED_QUEUE_NAME_PATTERNS.some(p => qLower.includes(p))) return false;
            if (q.startsWith("<")) return false;

            // Exclude Entity Records channel (192340000) client-side.
            // 192440000 = Voice — keep. PCF MDL blocks integer comparison on msdyn_channel.
            const ch = e["msdyn_channel"] as number | undefined;
            if (ch === 192340000) return false; // Entity Records only — 192440000 is Voice

            // Channel filter (client-side — MDL blocks server-side integer comparison)
            const chLabel = formattedValue(e, "msdyn_channel") ?? e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
            if (!shouldIncludeChannel(chLabel, f.channelKeys ?? new Set())) return false;

            return true;
        })
        .slice(0, 10)
        .map(e => ({
            id: e["msdyn_ocliveworkitemid"] as string,
            contactName: formattedValue(e, "_msdyn_customer_value") ?? "—",
            status: formattedValue(e, "statuscode") ?? "Unknown",
            activeAgent: formattedValue(e, "_msdyn_activeagentid_value") ?? "Unassigned",
            queue: formattedValue(e, "_msdyn_cdsqueueid_value") ?? "—",
            lastModified: formatElapsedSince(e["modifiedon"] as string | undefined),
            direction: e["msdyn_isoutbound"] ? "Outbound" : "Inbound",
        }));
}
