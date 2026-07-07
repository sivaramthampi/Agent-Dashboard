import * as React from "react";

export interface DonutSlice { label: string; value: number; color: string; }
export interface DonutChartProps {
    slices: DonutSlice[];
    isLoading: boolean;
    emptyMessage?: string;
    centerLabel?: string;
}

const R = 30;
const CX = 38;
const CY = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;

export const DonutChart: React.FC<DonutChartProps> = ({ slices, isLoading, emptyMessage, centerLabel }) => {
    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total === 0) return <div className="ad-chart-empty">{emptyMessage ?? "No data"}</div>;

    let offset = 0;
    const arcs = slices.map(s => {
        const dash = (s.value / total) * CIRCUMFERENCE;
        const arc = (
            <circle key={s.label} cx={CX} cy={CY} r={R}
                fill="none" stroke={s.color} strokeWidth="13"
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${CX} ${CY})`}
                strokeLinecap={slices.length > 1 ? "butt" : "round"}
            />
        );
        offset += dash;
        return arc;
    });

    return (
        <div className="ad-donut-wrap">
            <svg viewBox={`0 0 ${CX * 2} ${CY * 2}`} width="80" height="80">
                <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F3F4F6" strokeWidth="13" />
                {arcs}
                {centerLabel && (
                    <text x={CX} y={CY + 5} textAnchor="middle" className="ad-donut-center-text">{centerLabel}</text>
                )}
            </svg>
            <div className="ad-legend ad-legend-vertical">
                {slices.map(s => (
                    <div className="ad-legend-item" key={s.label}>
                        <span className="ad-legend-sw" style={{ background: s.color, width: 8, height: 8, borderRadius: "50%" }} />
                        {s.label} — {Math.round((s.value / total) * 100)}%
                    </div>
                ))}
            </div>
        </div>
    );
};
