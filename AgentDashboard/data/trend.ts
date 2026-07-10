import { isBotAgent, formattedValue, ENTITY_RECORDS_CHANNEL, combineFilters, ActiveFilters, shouldIncludeChannel } from "./dataverseUtils";

export interface TrendPoint { label: string; incoming: number; engaged: number; abandoned: number; }

export async function fetchTrend(webAPI: ComponentFramework.WebApi, f: ActiveFilters, bucketBy: "day" | "hour"): Promise<TrendPoint[]> {
    // Channel exclusion applied client-side — PCF MDL blocks integer filter on msdyn_channel
    const base = combineFilters(f);
    const query = `?$top=2000&$select=createdon,msdyn_isoutbound,msdyn_isabandoned,_msdyn_activeagentid_value,msdyn_channel&$filter=${base}&$orderby=createdon asc`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);
        const buckets = new Map<string, { incoming: number; engaged: number; abandoned: number; sortKey: number }>();
    for (const e of result.entities) {
        if (isBotAgent(formattedValue(e, "_msdyn_activeagentid_value") ?? "")) continue;
        const created = e["createdon"] ? new Date(e["createdon"] as string) : null;
        // Skip entity records channel client-side
        const ch = e["msdyn_channel"] as number | undefined;
        if (ch === 192340000) continue; // Entity Records only
        const chLabel = e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
        if (!shouldIncludeChannel(chLabel, f.channelKeys ?? new Set())) continue;
        if (!created) continue;
        const key = bucketBy === "hour" ? `${created.getHours()}:00` : `${created.toLocaleString("en-US",{month:"short"})} ${created.getDate()}`;
        const sortKey = bucketBy === "hour" ? created.getHours() : created.getTime();
        if (!buckets.has(key)) buckets.set(key, { incoming: 0, engaged: 0, abandoned: 0, sortKey });
        const b = buckets.get(key)!;
        if (!e["msdyn_isoutbound"]) b.incoming++;
        if (e["_msdyn_activeagentid_value"]) b.engaged++;
        if (e["msdyn_isabandoned"] === true) b.abandoned++;
    }
    return Array.from(buckets.entries())
        .map(([label, v]) => ({ label, incoming: v.incoming, engaged: v.engaged, abandoned: v.abandoned, sortKey: v.sortKey }))
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(({ label, incoming, engaged, abandoned }) => ({ label, incoming, engaged, abandoned }));
}
