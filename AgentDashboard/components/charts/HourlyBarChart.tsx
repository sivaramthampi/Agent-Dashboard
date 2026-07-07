import * as React from "react";
import { useState } from "react";
import { TrendPoint } from "../../data/trend";

export interface HourlyBarChartProps { points: TrendPoint[]; isLoading: boolean; }

const W = 300, H = 90, PAD_L = 24, PAD_B = 16, PAD_T = 6;

export const HourlyBarChart: React.FC<HourlyBarChartProps> = ({ points, isLoading }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; point: TrendPoint } | null>(null);

    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    if (points.length === 0) return <div className="ad-chart-empty">No data yet today</div>;

    const chartW = W - PAD_L;
    const chartH = H - PAD_B - PAD_T;
    const max = Math.max(1, ...points.map(p => Math.max(p.incoming, p.engaged)));
    const slotW = chartW / points.length;
    const barW = Math.max(2, slotW * 0.32);

    // Y-axis gridlines
    const yTicks = [0, Math.round(max / 2), max];

    return (
        <div style={{ position: "relative" }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: "visible" }}>
                {/* Y-axis gridlines + labels */}
                {yTicks.map(v => {
                    const y = PAD_T + chartH - (v / max) * chartH;
                    return (
                        <g key={v}>
                            <line x1={PAD_L} y1={y} x2={W} y2={y} stroke="rgba(0,0,0,.06)" strokeWidth="1" />
                            <text x={PAD_L - 3} y={y + 3.5} textAnchor="end" fontSize="8" fill="#94A3B8">{v}</text>
                        </g>
                    );
                })}

                {/* bars */}
                {points.map((p, i) => {
                    const slotX = PAD_L + i * slotW;
                    const inH = Math.max(1, (p.incoming / max) * chartH);
                    const enH = Math.max(1, (p.engaged  / max) * chartH);
                    const cx = slotX + slotW / 2;

                    return (
                        <g key={p.label}
                           onMouseEnter={e => {
                               const svg = (e.currentTarget as SVGGElement).ownerSVGElement!;
                               const rect = svg.getBoundingClientRect();
                               const px = cx / W * rect.width + rect.left;
                               const py = (PAD_T) / H * rect.height + rect.top;
                               setTooltip({ x: px, y: py, point: p });
                           }}
                           onMouseLeave={() => setTooltip(null)}
                           style={{ cursor: "default" }}
                        >
                            {/* incoming bar */}
                            <rect
                                x={slotX + slotW * 0.08}
                                y={PAD_T + chartH - inH}
                                width={barW} height={inH} rx="1.5"
                                fill="#6366F1"
                            />
                            {/* engaged bar */}
                            <rect
                                x={slotX + slotW * 0.08 + barW + 1}
                                y={PAD_T + chartH - enH}
                                width={barW} height={enH} rx="1.5"
                                fill="#2DD4BF"
                            />
                            {/* x-axis label — show every 3rd */}
                            {i % Math.max(1, Math.floor(points.length / 6)) === 0 && (
                                <text x={cx} y={H - 3} textAnchor="middle" fontSize="8" fill="#94A3B8">
                                    {p.label}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* x-axis baseline */}
                <line x1={PAD_L} y1={PAD_T + chartH} x2={W} y2={PAD_T + chartH} stroke="rgba(0,0,0,.08)" strokeWidth="1" />
            </svg>

            {/* legend */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#6366F1" }} />
                    Incoming
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B" }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#2DD4BF" }} />
                    Engaged
                </span>
            </div>

            {/* tooltip */}
            {tooltip && (
                <div style={{
                    position: "fixed",
                    left: tooltip.x + 8,
                    top: tooltip.y - 8,
                    background: "#0F172A",
                    color: "#fff",
                    fontSize: 11,
                    padding: "5px 9px",
                    borderRadius: 7,
                    pointerEvents: "none",
                    zIndex: 9999,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(0,0,0,.25)",
                }}>
                    <strong>{tooltip.point.label}</strong>
                    &nbsp;· In: {tooltip.point.incoming} &nbsp;Eng: {tooltip.point.engaged}
                </div>
            )}
        </div>
    );
};
