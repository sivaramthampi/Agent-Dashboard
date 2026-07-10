import { combineFilters, ActiveFilters, getOrgLocalHour } from "./dataverseUtils";

export interface HourlyVolumePoint { hour: number; label: string; count: number; }

function formatHourLabel(hour: number): string {
    const h = ((hour % 24) + 24) % 24;
    return h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
}

// Full-day (00:00–24:00, ORG-LOCAL time) hourly conversation volume for YESTERDAY,
// scoped to the same queue/agent filters as the KPI strip.
//
// IMPORTANT: this intentionally matches fetchKpis()'s "total" methodology exactly —
// same base filter (date/queue/agent), NO bot-agent exclusion, NO client-side channel
// exclusion. Earlier this file filtered out bots and non-selected channels the way
// trend.ts does, which made the hourly totals here NOT reconcile with the "Total
// Conversations" KPI tile (which counts everything via a plain server-side count).
// If bot/channel exclusion is wanted here later, the KPI tile's total would need the
// same treatment first so the two stay consistent with each other.
//
// orgTimezoneBias must be passed through — bucketing by raw Date.getHours() reads the
// BROWSER's timezone, not the org's, which silently shifts every hour bucket if the two
// don't match (this caused peak volume to appear at midnight instead of business hours).
export async function fetchYesterdayHourlyVolume(
    webAPI: ComponentFramework.WebApi,
    f: ActiveFilters,
    orgTimezoneBias?: number
): Promise<HourlyVolumePoint[]> {
    const base = combineFilters(f);
    const query = `?$top=2000&$select=createdon&$filter=${base}&$orderby=createdon asc`;
    const result = await webAPI.retrieveMultipleRecords("msdyn_ocliveworkitem", query);

    const buckets = new Map<number, number>();
    for (let h = 0; h < 24; h++) buckets.set(h, 0);

    for (const e of result.entities) {
        const created = e["createdon"] as string | undefined;
        if (!created) continue;
        const h = getOrgLocalHour(created, orgTimezoneBias);
        buckets.set(h, (buckets.get(h) ?? 0) + 1);
    }

    return Array.from(buckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hour, count]) => ({ hour, label: formatHourLabel(hour), count }));
}

export interface PeakRangeInsight {
    startLabel: string; endLabel: string;
    startHour: number; endHour: number;
    totalCount: number;
}

// Returns the single busiest hour as a tight 1-hour window (e.g. "9am to 10am"),
// not a broad plateau — a wide multi-hour range isn't a useful staffing signal.
// endLabel is the hour AFTER the peak bucket, so it reads as a natural boundary
// ("9am to 10am" means the 9:00–10:00 hour, not the instant 9am).
export function findPeakHourRange(points: HourlyVolumePoint[]): PeakRangeInsight | null {
    if (points.length === 0) return null;
    const peak = points.reduce((best, p) => (p.count > best.count ? p : best), points[0]);
    if (peak.count === 0) return null;

    return {
        startHour: peak.hour,
        endHour: peak.hour,
        startLabel: peak.label,
        endLabel: formatHourLabel(peak.hour + 1),
        totalCount: peak.count,
    };
}

