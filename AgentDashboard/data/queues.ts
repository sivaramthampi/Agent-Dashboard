import { FilterOption } from "../types";
import { EXCLUDED_QUEUE_NAME_PATTERNS } from "./dataverseUtils";

// Fetches Omnichannel queues from the queue entity.
// msdyn_queuetype 192350002 = Omnichannel queue (confirmed passing in Script B: 10 results).
// Practice/demo exclusion applied client-side (name comparison).
export async function fetchQueueOptions(webAPI: ComponentFramework.WebApi): Promise<FilterOption[]> {
    const query =
        "?$select=queueid,name" +
        "&$filter=msdyn_queuetype eq 192350002 and statecode eq 0" +
        "&$orderby=name asc" +
        "&$top=200";

    const result = await webAPI.retrieveMultipleRecords("queue", query);

    return result.entities
        .map(e => ({
            key: e["queueid"] as string,
            label: e["name"] as string,
        }))
        .filter(opt => {
            const name = (opt.label ?? "").toLowerCase();
            if (name.startsWith("<")) return false;
            if (name.includes("default")) return false;
            for (const pattern of EXCLUDED_QUEUE_NAME_PATTERNS) {
                if (name.includes(pattern)) return false;
            }
            return true;
        });
}

// Fetch queue IDs the logged-in user is a member of via queuemembership entity
export async function fetchUserQueueIds(
    webAPI: ComponentFramework.WebApi,
    userId: string
): Promise<Set<string>> {
    if (!userId) return new Set();
    try {
        // Lowercase the userId — Dataverse systemuserid filter is case-sensitive
        // PCF context.userSettings.userId returns uppercase, Xrm returns lowercase
        const normalizedId = userId.toLowerCase();
        const result = await webAPI.retrieveMultipleRecords(
            "queuemembership",
            `?$select=queueid,systemuserid&$filter=systemuserid eq ${normalizedId}&$top=100`
        );
        console.log(
            "%c[AD fetchUserQueueIds]",
            "background:#059669;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
            `Found ${result.entities.length} memberships for userId: ${normalizedId}`,
            result.entities.slice(0,3)
        );
        return new Set(result.entities.map(e => e["queueid"] as string).filter(Boolean));
    } catch (e) {
        console.error("AgentDashboard: fetchUserQueueIds failed", e);
        return new Set();
    }
}