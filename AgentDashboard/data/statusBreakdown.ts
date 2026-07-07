import { formattedValue, isBotAgent, ENTITY_RECORDS_CHANNEL, combineFilters, ActiveFilters, shouldIncludeChannel } from "./dataverseUtils";

export interface StatusBreakdownItem { status: string; count: number; }

export async function fetchStatusBreakdown(webAPI: ComponentFramework.WebApi, f: ActiveFilters): Promise<StatusBreakdownItem[]> {
    // Channel exclusion applied client-side — PCF MDL blocks integer filter on msdyn_channel
    // Include both statecode (open records) AND date filter so we only show today's conversations
    const dateScope = f.dateFilter ? `${f.dateFilter} and statecode eq 0` : "statecode eq 0";
    const base = combineFilters({ ...f, dateFilter: dateScope });
    const query = `?$top=500&$select=msdyn_ocliveworkitemid,statuscode,_msdyn_activeagentid_value,msdyn_channel&$filter=${base}`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);
        const counts = new Map<string, number>();
    for (const e of result.entities) {
        if (isBotAgent(formattedValue(e, "_msdyn_activeagentid_value") ?? "")) continue;
        // Skip entity records channel
        const ch = e["msdyn_channel"] as number | undefined;
        if (ch === 192340000) continue; // Entity Records only
        const chLabel = e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
        if (!shouldIncludeChannel(chLabel, f.channelKeys ?? new Set())) continue;
        const label = formattedValue(e, "statuscode") ?? "Unknown";
        counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);
}
