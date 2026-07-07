import * as React from "react";
import { KpiValues } from "../data/kpis";
import { ConversationRow } from "../types";

const ABANDONED_THRESHOLD_PCT = 5;
const UNASSIGNED_THRESHOLD_MIN = 5;

interface Props {
    kpi: KpiValues | null;
    conversations: ConversationRow[];
}

function parseElapsedMinutes(elapsed: string): number {
    const parts = elapsed.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1];
    if (parts.length === 2) return parts[0];
    return 0;
}

export const AlertBanner: React.FC<Props> = ({ kpi, conversations }) => {
    const alerts: React.ReactNode[] = [];

    // Abandoned rate alert
    if (kpi && kpi.abandonedRatePct > ABANDONED_THRESHOLD_PCT) {
        alerts.push(
            <div key="abandoned" className="ad-alert-banner ad-alert-danger">
                <span className="ad-alert-icon">⚠</span>
                <div>
                    <span className="ad-alert-title">
                        Abandoned rate at {kpi.abandonedRatePct.toFixed(1)}% — above {ABANDONED_THRESHOLD_PCT}% threshold
                    </span>
                </div>
            </div>
        );
    }

    // Unassigned conversations alert
    const unassigned = conversations.filter(c =>
        c.activeAgent === "Unassigned" &&
        parseElapsedMinutes(c.lastModified) >= UNASSIGNED_THRESHOLD_MIN
    );
    if (unassigned.length > 0) {
        const oldest = Math.max(...unassigned.map(c => parseElapsedMinutes(c.lastModified)));
        alerts.push(
            <div key="unassigned" className="ad-alert-banner ad-alert-warning">
                <span className="ad-alert-icon">⏱</span>
                <div>
                    <span className="ad-alert-title">
                        {unassigned.length} unassigned conversation{unassigned.length > 1 ? "s" : ""} waiting over {UNASSIGNED_THRESHOLD_MIN} minutes
                    </span>
                    <span className="ad-alert-sub"> · Oldest: {oldest} min</span>
                </div>
            </div>
        );
    }

    if (alerts.length === 0) return null;
    return <div className="ad-alerts">{alerts}</div>;
};
