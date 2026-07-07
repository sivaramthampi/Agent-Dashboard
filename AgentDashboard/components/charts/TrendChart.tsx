import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { TrendPoint } from "../../data/trend";

export interface TrendChartProps {
    points: TrendPoint[];
    isLoading: boolean;
}

const WIDTH = 560;
const HEIGHT = 160;
const PAD_X = 32;
const PAD_Y = 12;

function toSvgX(i: number, total: number): number {
    return PAD_X + (i / Math.max(1, total - 1)) * (WIDTH - 2 * PAD_X);
}

function toSvgY(v: number, max: number): number {
    return HEIGHT - PAD_Y - (max > 0 ? (v / max) * (HEIGHT - 2 * PAD_Y) : 0);
}

function buildLinePath(values: number[], max: number): string {
    return values
        .map((v, i) => `${i === 0 ? "M" : "L"}${toSvgX(i, values.length).toFixed(1)},${toSvgY(v, max).toFixed(1)}`)
        .join(" ");
}

function buildAreaPath(values: number[], max: number): string {
    if (values.length === 0) return "";
    const line = buildLinePath(values, max);
    const lastX = toSvgX(values.length - 1, values.length).toFixed(1);
    const baseY = (HEIGHT - PAD_Y).toFixed(1);
    return `${line} L${lastX},${baseY} L${PAD_X},${baseY} Z`;
}

export const TrendChart: React.FC<TrendChartProps> = ({ points, isLoading }) => {
    const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const max = Math.max(1, ...points.map(p => Math.max(p.incoming, p.engaged)));
    const labelStep = Math.max(1, Math.ceil(points.length / 6));

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || points.length === 0) return;
        const rect = svgRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * WIDTH;
        let closest = 0;
        let minDist = Infinity;
        points.forEach((_, i) => {
            const d = Math.abs(toSvgX(i, points.length) - mouseX);
            if (d < minDist) { minDist = d; closest = i; }
        });
        if (minDist < 30) {
            setHover({
                index: closest,
                x: toSvgX(closest, points.length),
                y: toSvgY(points[closest].incoming, max),
            });
        } else {
            setHover(null);
        }
    }, [points, max]);

    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    if (points.length === 0) return <div className="ad-chart-empty">No data for this period</div>;

    const incomingPath = buildLinePath(points.map(p => p.incoming), max);
    const engagedPath = buildLinePath(points.map(p => p.engaged), max);
    const incomingArea = buildAreaPath(points.map(p => p.incoming), max);

    const hoveredPoint = hover !== null ? points[hover.index] : null;

    return (
        <div className="ad-trend-chart">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                width="100%"
                height={HEIGHT}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "crosshair" }}
            >
                <defs>
                    <linearGradient id="adTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid lines */}
                {[0, 0.5, 1].map((frac) => {
                    const yv = toSvgY(frac * max, max);
                    return (
                        <g key={frac}>
                            <line x1={PAD_X} y1={yv} x2={WIDTH - PAD_X} y2={yv} stroke="#E4E6EA" strokeWidth="1" />
                            <text x={PAD_X - 4} y={yv + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">
                                {Math.round(frac * max)}
                            </text>
                        </g>
                    );
                })}

                {/* Area fill */}
                <path d={incomingArea} fill="url(#adTrendFill)" />

                {/* Lines */}
                <path d={incomingPath} fill="none" stroke="#6366F1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d={engagedPath} fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Hover crosshair */}
                {hover && (
                    <line
                        x1={hover.x} y1={PAD_Y}
                        x2={hover.x} y2={HEIGHT - PAD_Y}
                        stroke="#E4E6EA" strokeWidth="1" strokeDasharray="3 3"
                    />
                )}

                {/* Data point dots — only on hover */}
                {hover && points.map((p, i) => {
                    if (i !== hover.index) return null;
                    return (
                        <g key={i}>
                            <circle cx={toSvgX(i, points.length)} cy={toSvgY(p.incoming, max)} r="4.5" fill="#fff" stroke="#6366F1" strokeWidth="2" />
                            <circle cx={toSvgX(i, points.length)} cy={toSvgY(p.engaged, max)} r="4.5" fill="#fff" stroke="#2DD4BF" strokeWidth="2" />
                        </g>
                    );
                })}

                {/* Hover tooltip rendered inside SVG as foreignObject for rich layout */}
                {hover && hoveredPoint && (() => {
                    const tx = Math.min(hover.x + 10, WIDTH - 130);
                    const ty = Math.max(PAD_Y, hover.y - 50);
                    return (
                        <g>
                            <rect x={tx} y={ty} width="120" height="44" rx="6" fill="#111827" opacity="0.92" />
                            <text x={tx + 10} y={ty + 16} fontSize="11" fontWeight="500" fill="#fff">{hoveredPoint.label}</text>
                            <circle cx={tx + 10} cy={ty + 28} r="3" fill="#6366F1" />
                            <text x={tx + 17} y={ty + 32} fontSize="10" fill="#D1D5DB">In: {hoveredPoint.incoming}</text>
                            <circle cx={tx + 65} cy={ty + 28} r="3" fill="#2DD4BF" />
                            <text x={tx + 72} y={ty + 32} fontSize="10" fill="#D1D5DB">Eng: {hoveredPoint.engaged}</text>
                        </g>
                    );
                })()}

                {/* X-axis labels */}
                {points.map((p, i) =>
                    i % labelStep === 0 ? (
                        <text key={p.label} x={toSvgX(i, points.length)} y={HEIGHT - 1} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                            {p.label}
                        </text>
                    ) : null
                )}
            </svg>

            <div className="ad-legend">
                <div className="ad-legend-item">
                    <span className="ad-legend-sw" style={{ background: "#6366F1" }} />Incoming
                </div>
                <div className="ad-legend-item">
                    <span className="ad-legend-sw" style={{ background: "#2DD4BF" }} />Engaged
                </div>
            </div>
        </div>
    );
};
