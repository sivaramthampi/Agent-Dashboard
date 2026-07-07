import * as React from "react";
import { StatusBreakdownItem } from "../../data/statusBreakdown";

export interface StatusBreakdownChartProps {
    items: StatusBreakdownItem[];
    isLoading: boolean;
}

const STATUS_COLOR: Record<string, string> = {
    "Active":  "#10B981",
    "Waiting": "#F59E0B",
    "Wrap-up": "#6366F1",
    "Open":    "#F97316",
};
const DEFAULT_COLOR = "#9CA3AF";

export const StatusBreakdownChart: React.FC<StatusBreakdownChartProps> = ({ items, isLoading }) => {
    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    if (items.length === 0) return <div className="ad-chart-empty">No ongoing conversations</div>;

    const max = Math.max(1, ...items.map(i => i.count));
    return (
        <div className="ad-status-breakdown">
            {items.map(item => (
                <div className="ad-status-row" key={item.status}>
                    <div className="ad-status-row-head">
                        <span>{item.status}</span>
                        <span className="ad-mono">{item.count}</span>
                    </div>
                    <div className="ad-status-bar-track">
                        <div
                            className="ad-status-bar-fill"
                            style={{
                                width: `${(item.count / max) * 100}%`,
                                background: STATUS_COLOR[item.status] ?? DEFAULT_COLOR,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};
