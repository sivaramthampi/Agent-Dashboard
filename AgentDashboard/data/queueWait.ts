import { QueueWaitRow } from "../types";
import { formattedValue, formatSeconds, isBotAgent, EXCLUDED_QUEUE_NAME_PATTERNS, combineFilters, ActiveFilters, shouldIncludeChannel } from "./dataverseUtils";

export async function fetchAvgWaitByQueue(webAPI: ComponentFramework.WebApi, f: ActiveFilters): Promise<QueueWaitRow[]> {
    // Channel exclusion applied client-side — PCF MDL layer blocks ALL integer
    // comparisons on msdyn_channel (Edm.String vs Edm.Int32 type mismatch in MDL).
    const base = combineFilters(f);
    const query = `?$top=500&$select=msdyn_ocliveworkitemid,msdyn_conversationfirstwaittimeinseconds,_msdyn_cdsqueueid_value,_msdyn_activeagentid_value,msdyn_channel&$filter=${base}`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);

    
    // Track count of all conversations per queue (including null wait),
    // and sum of wait times only where populated (chat/SMS — not voice).
    const sums = new Map<string, { total: number; withWait: number; total_convs: number }>();

    for (const e of result.entities) {
        // Bot exclusion
        const agent = (formattedValue(e, "_msdyn_activeagentid_value") ?? "").toLowerCase();
        if (isBotAgent(agent)) continue;

        // Queue exclusion
        const queueName = formattedValue(e, "_msdyn_cdsqueueid_value");
        if (!queueName) continue;
        const qLower = queueName.toLowerCase();
        if (EXCLUDED_QUEUE_NAME_PATTERNS.some(p => qLower.includes(p))) continue;
        if (queueName.startsWith("<")) continue;

        // Channel exclusion — 192340000 = Entity Records (non-human), skip
        // 192440000 = Voice — keep, wait will be null which is expected
        const ch = e["msdyn_channel"] as number | undefined;
        if (ch === 192340000) continue; // Entity Records only
        const chLabel = e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
        if (!shouldIncludeChannel(chLabel, f.channelKeys ?? new Set())) continue;

        const wait = e["msdyn_conversationfirstwaittimeinseconds"];
        const entry = sums.get(queueName) ?? { total: 0, withWait: 0, total_convs: 0 };
        entry.total_convs++;
        if (typeof wait === "number") {
            entry.total += wait;
            entry.withWait++;
        }
        sums.set(queueName, entry);
    }

    return Array.from(sums.entries())
        .filter(([, s]) => s.total_convs > 0)
        .map(([queue, s]) => ({
            queue,
            // If no wait times populated (all voice), show "—" not "0s"
            avgWait: s.withWait > 0 ? formatSeconds(s.total / s.withWait) : "—",
        }))
        .sort((a, b) => a.queue.localeCompare(b.queue));
}
