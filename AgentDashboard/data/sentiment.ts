import { ENTITY_RECORDS_CHANNEL, isBotAgent, formattedValue, ActiveFilters, combineFilters, shouldIncludeChannel } from "./dataverseUtils";

// Confirmed choice values from Dataverse field definition
// These are identifiers only — NOT used as weights
export const SENTIMENT_VALUES = {
    NA:                 0,
    VERY_NEGATIVE:      7,
    NEGATIVE:           8,
    SLIGHTLY_NEGATIVE:  9,
    NEUTRAL:           10,
    SLIGHTLY_POSITIVE: 11,
    POSITIVE:          12,
    VERY_POSITIVE:     13,
} as const;

// 7 sentiment buckets matching the field exactly
export type SentimentGroup =
    | "very_negative"
    | "negative"
    | "slightly_negative"
    | "neutral"
    | "slightly_positive"
    | "positive"
    | "very_positive"
    | "na";

export interface SentimentBreakdown {
    veryPositive:      number;
    positive:          number;
    slightlyPositive:  number;
    neutral:           number;
    slightlyNegative:  number;
    negative:          number;
    veryNegative:      number;
    total:             number;
    // Average score on a -3 to +3 scale (not using choice values as weights)
    // -3 = all very negative, 0 = all neutral, +3 = all very positive
    averageScore:      number;
    overallGroup:      SentimentGroup;
}

// Map choice value → bucket
function toGroup(val: number | undefined | null): SentimentGroup | "na" {
    switch (val) {
        case 13: return "very_positive";
        case 12: return "positive";
        case 11: return "slightly_positive";
        case 10: return "neutral";
        case  9: return "slightly_negative";
        case  8: return "negative";
        case  7: return "very_negative";
        default: return "na";
    }
}

// Assign a meaningful weight per bucket for average calculation
// Scale: -3 (very negative) to +3 (very positive)
const GROUP_WEIGHT: Record<string, number> = {
    very_positive:     3,
    positive:          2,
    slightly_positive: 1,
    neutral:           0,
    slightly_negative: -1,
    negative:          -2,
    very_negative:     -3,
};

function calcOverall(avg: number): SentimentGroup {
    if (avg >= 2.5)  return "very_positive";
    if (avg >= 1.0)  return "positive";
    if (avg >= 0.25) return "slightly_positive";
    if (avg >= -0.25) return "neutral";
    if (avg >= -1.0) return "slightly_negative";
    if (avg >= -2.5) return "negative";
    return "very_negative";
}

export async function fetchSentimentBreakdown(
    webAPI: ComponentFramework.WebApi,
    f: ActiveFilters
): Promise<SentimentBreakdown> {
    // Previously this only took dateFilter, so queue/channel/agent selections never
    // reached the Customer Sentiment tile at all. Queue and agent filter server-side
    // via the same combineFilters() every other tile uses; channel remains
    // client-side only (see shouldIncludeChannel / MDL note in dataverseUtils.ts).
    const base = combineFilters(f);
    const filter = `${base} and msdyn_customersentimentlabel ne null`;
    const query = `?$top=500&$select=msdyn_customersentimentlabel,_msdyn_activeagentid_value,msdyn_channel&$filter=${filter}`;

    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);
    
    const counts = {
        veryPositive: 0, positive: 0, slightlyPositive: 0,
        neutral: 0,
        slightlyNegative: 0, negative: 0, veryNegative: 0,
    };
    let weightSum = 0;

    for (const e of result.entities) {
        const agent = (formattedValue(e, "_msdyn_activeagentid_value") ?? "").toLowerCase();
        if (isBotAgent(agent)) continue;

        const chLabel = e["msdyn_channel@OData.Community.Display.V1.FormattedValue"] as string | undefined;
        if (!shouldIncludeChannel(chLabel, f.channelKeys ?? new Set())) continue;

        const val = e["msdyn_customersentimentlabel"] as number | undefined | null;
        const group = toGroup(val);
        if (group === "na") continue;

        if (group === "very_positive")     counts.veryPositive++;
        else if (group === "positive")      counts.positive++;
        else if (group === "slightly_positive") counts.slightlyPositive++;
        else if (group === "neutral")       counts.neutral++;
        else if (group === "slightly_negative") counts.slightlyNegative++;
        else if (group === "negative")      counts.negative++;
        else                                counts.veryNegative++;

        weightSum += GROUP_WEIGHT[group] ?? 0;
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const averageScore = total > 0 ? weightSum / total : 0;

    return {
        ...counts,
        total,
        averageScore: Math.round(averageScore * 100) / 100,
        overallGroup: total > 0 ? calcOverall(averageScore) : "na",
    };
}
