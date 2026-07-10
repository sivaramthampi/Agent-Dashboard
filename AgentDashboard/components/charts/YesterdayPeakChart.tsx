import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { HourlyVolumePoint, findPeakHourRange } from "../../data/yesterdayVolume";

export interface YesterdayPeakChartProps {
    points: HourlyVolumePoint[];
    isLoading: boolean;
}

const WIDTH = 900;
const HEIGHT = 200;
const PAD_X = 36;
const PAD_Y = 16;

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

export const YesterdayPeakChart: React.FC<YesterdayPeakChartProps> = ({ points, isLoading }) => {
    const [hover, setHover] = useState<{ index: number } | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const max = Math.max(1, ...points.map(p => p.count));
    const labelStep = Math.max(1, Math.ceil(points.length / 12));
    const peakRange = findPeakHourRange(points);

    // Uses the SVG's own screen-to-user-space transform matrix instead of a manual
    // ratio calculation — this stays accurate regardless of the panel's aspect ratio,
    // so we don't need preserveAspectRatio="none" (which was distorting/stretching
    // the chart's visual proportions to force the ratio math to line up).
    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current || points.length === 0) return;
        const svg = svgRef.current;
        const ctm = svg.getScreenCTM();
        if (!ctm) return;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgPoint = pt.matrixTransform(ctm.inverse());
        let closest = 0;
        let minDist = Infinity;
        points.forEach((_, i) => {
            const d = Math.abs(toSvgX(i, points.length) - svgPoint.x);
            if (d < minDist) { minDist = d; closest = i; }
        });
        setHover({ index: closest });
    }, [points]);

    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    if (points.length === 0 || !peakRange) return <div className="ad-chart-empty">No conversation data for yesterday</div>;

    const linePath = buildLinePath(points.map(p => p.count), max);
    const areaPath = buildAreaPath(points.map(p => p.count), max);
    const hoveredPoint = hover !== null ? points[hover.index] : null;

    const rangeStartIdx = points.findIndex(p => p.hour === peakRange.startHour);
    const rangeEndIdx = points.findIndex(p => p.hour === peakRange.endHour);
    const bandX1 = toSvgX(rangeStartIdx, points.length) - (WIDTH - 2 * PAD_X) / (points.length - 1) / 2;
    const bandX2 = toSvgX(rangeEndIdx, points.length) + (WIDTH - 2 * PAD_X) / (points.length - 1) / 2;

    return (
        <div className="ad-trend-chart">
            <div className="ad-insight-banner ad-insight-minimal">
                Yesterday's Peak Hours: {peakRange.startLabel} to {peakRange.endLabel}
            </div>
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
                    <linearGradient id="adYesterdayFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.14" />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Peak range band — behind everything else */}
                <rect x={bandX1} y={PAD_Y} width={bandX2 - bandX1} height={HEIGHT - 2 * PAD_Y} fill="#FBBF24" opacity="0.10" />

                {/* Grid lines */}
                {[0, 0.5, 1].map((frac) => {
                    const yv = toSvgY(frac * max, max);
                    return (
                        <g key={frac}>
                            <line x1={PAD_X} y1={yv} x2={WIDTH - PAD_X} y2={yv} stroke="#E4E6EA" strokeWidth="1" />
                            <text x={PAD_X - 6} y={yv + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">
                                {Math.round(frac * max)}
                            </text>
                        </g>
                    );
                })}

                {/* Area fill + line — lighter purple */}
                <path d={areaPath} fill="url(#adYesterdayFill)" />
                <path d={linePath} fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Hover crosshair + dot */}
                {hover && (
                    <line x1={toSvgX(hover.index, points.length)} y1={PAD_Y} x2={toSvgX(hover.index, points.length)} y2={HEIGHT - PAD_Y} stroke="#E4E6EA" strokeWidth="1" strokeDasharray="3 3" />
                )}
                {hover && hoveredPoint && (
                    <circle cx={toSvgX(hover.index, points.length)} cy={toSvgY(hoveredPoint.count, max)} r="4" fill="#fff" stroke="#A78BFA" strokeWidth="2" />
                )}

                {/* Hover tooltip */}
                {hover && hoveredPoint && (() => {
                    const hx = toSvgX(hover.index, points.length);
                    const hy = toSvgY(hoveredPoint.count, max);
                    const tx = Math.min(Math.max(hx + 10, PAD_X), WIDTH - 140);
                    const ty = Math.max(PAD_Y, hy - 40);
                    return (
                        <g>
                            <rect x={tx} y={ty} width="130" height="32" rx="6" fill="#111827" opacity="0.9" />
                            <text x={tx + 10} y={ty + 14} fontSize="11" fontWeight="500" fill="#fff">{hoveredPoint.label}</text>
                            <text x={tx + 10} y={ty + 27} fontSize="10" fill="#D1D5DB">{hoveredPoint.count} conversations</text>
                        </g>
                    );
                })()}

                {/* X-axis labels */}
                {points.map((p, i) =>
                    i % labelStep === 0 ? (
                        <text key={p.hour} x={toSvgX(i, points.length)} y={HEIGHT - 1} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                            {p.label}
                        </text>
                    ) : null
                )}
            </svg>
        </div>
    );
};
