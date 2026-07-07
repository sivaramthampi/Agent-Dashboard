import { runAggregate, combineFilters, ActiveFilters } from "./dataverseUtils";

export interface KpiValues {
    total: number; incoming: number; outgoing: number;
    inQueue: number; engaged: number; abandonedRatePct: number;
    avgSpeedToAnswerMs: number; avgHandleTimeConversationSec: number;
    avgHandleTimeSessionSec: number; longestWaitSec: number; transferRatePct: number;
}

const E = "msdyn_ocliveworkitem";

export async function fetchKpis(webAPI: ComponentFramework.WebApi, f: ActiveFilters): Promise<KpiValues> {
    const base = combineFilters(f);
    const [total, incoming, outgoing, inQueue, engaged, abandonedCount,
        avgSpeedToAnswerMs, avgHandleTimeConvSec, avgHandleTimeSessSec,
        longestWaitSec, transferredCount] = await Promise.all([
        runAggregate(webAPI, E, base, undefined, "count"),
        runAggregate(webAPI, E, `${base} and msdyn_isoutbound eq false`, undefined, "count"),
        runAggregate(webAPI, E, `${base} and msdyn_isoutbound eq true`, undefined, "count"),
        runAggregate(webAPI, E, `${base} and statecode eq 0 and _msdyn_activeagentid_value eq null`, undefined, "count"),
        runAggregate(webAPI, E, `${base} and statecode eq 0 and _msdyn_activeagentid_value ne null`, undefined, "count"),
        runAggregate(webAPI, E, `${base} and msdyn_isabandoned eq true`, undefined, "count"),
        runAggregate(webAPI, E, base, "msdyn_firstresponsetimeinmsadjforoh", "average"),
        runAggregate(webAPI, E, `${base} and msdyn_isagentsession eq false`, "msdyn_conversationhandletimeinseconds", "average"),
        runAggregate(webAPI, E, `${base} and msdyn_isagentsession eq true`, "msdyn_conversationhandletimeinseconds", "average"),
        runAggregate(webAPI, E, base, "msdyn_conversationfirstwaittimeinseconds", "max"),
        runAggregate(webAPI, E, `${base} and msdyn_transfercount gt 0`, undefined, "count"),
    ]);
    return {
        total, incoming, outgoing, inQueue, engaged,
        abandonedRatePct: total > 0 ? (abandonedCount / total) * 100 : 0,
        avgSpeedToAnswerMs,
        avgHandleTimeConversationSec: avgHandleTimeConvSec,
        avgHandleTimeSessionSec: avgHandleTimeSessSec,
        longestWaitSec, transferRatePct: total > 0 ? (transferredCount / total) * 100 : 0,
    };
}
