import * as React from "react";
import { SentimentBreakdown, SentimentGroup } from "../../data/sentiment";

const COLOR: Record<string, string> = {
    veryPositive:     "#059669",
    positive:         "#34D399",
    slightlyPositive: "#A7F3D0",
    neutral:          "#94A3B8",
    slightlyNegative: "#FCA5A5",
    negative:         "#F87171",
    veryNegative:     "#DC2626",
};

// Live sentiment icon shown in centre of donut
function SentimentIcon({ group, size = 26 }: { group: SentimentGroup; size?: number }) {
    const c = size / 2;
    switch (group) {
        case "very_positive":
            // Heart
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <path d="M16 28S2 19.6 2 11a8 8 0 0 1 14-5.3A8 8 0 0 1 30 11c0 8.6-14 17-14 17z"
                        fill="#059669" />
                </svg>
            );
        case "positive":
            // Big smile
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#34D399" />
                    <circle cx="11" cy="13" r="1.8" fill="#065F46" />
                    <circle cx="21" cy="13" r="1.8" fill="#065F46" />
                    <path d="M9 18 Q16 26 23 18" fill="none" stroke="#065F46" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );
        case "slightly_positive":
            // Slight smile
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#A7F3D0" />
                    <circle cx="11" cy="13" r="1.8" fill="#065F46" />
                    <circle cx="21" cy="13" r="1.8" fill="#065F46" />
                    <path d="M11 20 Q16 24 21 20" fill="none" stroke="#065F46" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case "neutral":
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#E2E8F0" />
                    <circle cx="11" cy="13" r="1.8" fill="#475569" />
                    <circle cx="21" cy="13" r="1.8" fill="#475569" />
                    <line x1="10" y1="21" x2="22" y2="21" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case "slightly_negative":
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#FCA5A5" />
                    <circle cx="11" cy="13" r="1.8" fill="#7F1D1D" />
                    <circle cx="21" cy="13" r="1.8" fill="#7F1D1D" />
                    <path d="M11 22 Q16 18 21 22" fill="none" stroke="#7F1D1D" strokeWidth="2" strokeLinecap="round" />
                </svg>
            );
        case "negative":
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#F87171" />
                    <circle cx="11" cy="13" r="1.8" fill="#7F1D1D" />
                    <circle cx="21" cy="13" r="1.8" fill="#7F1D1D" />
                    <path d="M9 24 Q16 16 23 24" fill="none" stroke="#7F1D1D" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );
        case "very_negative":
            // Angry — furrowed brows
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#DC2626" />
                    <path d="M7 11 Q11 8 14 11" fill="none" stroke="#7F1D1D" strokeWidth="2" strokeLinecap="round" />
                    <path d="M18 11 Q21 8 25 11" fill="none" stroke="#7F1D1D" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="11" cy="14" r="1.8" fill="#7F1D1D" />
                    <circle cx="21" cy="14" r="1.8" fill="#7F1D1D" />
                    <path d="M9 25 Q16 17 23 25" fill="none" stroke="#7F1D1D" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="14" fill="#F1F5F9" />
                    <line x1="10" y1="16" x2="22" y2="16" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
            );
    }
}

const GROUP_LABEL: Record<string, string> = {
    very_positive:     "Very Positive",
    positive:          "Positive",
    slightly_positive: "Slightly Positive",
    neutral:           "Neutral",
    slightly_negative: "Slightly Negative",
    negative:          "Negative",
    very_negative:     "Very Negative",
    na:                "No data",
};

const R = 30, CX = 38, CY = 38, CIRC = 2 * Math.PI * R;

interface Props { data: SentimentBreakdown | null; isLoading: boolean; }

export const SentimentDonut: React.FC<Props> = ({ data, isLoading }) => {
    if (isLoading) return <div className="ad-chart-empty">Loading…</div>;
    if (!data || data.total === 0) return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <SentimentIcon group="na" size={36} />
            <span style={{ fontSize: 11, color: "#94A3B8" }}>No sentiment data</span>
        </div>
    );

    const slices = [
        { key: "veryPositive",     label: "Very Positive",      value: data.veryPositive,     color: COLOR.veryPositive },
        { key: "positive",         label: "Positive",            value: data.positive,          color: COLOR.positive },
        { key: "slightlyPositive", label: "Slightly Positive",   value: data.slightlyPositive,  color: COLOR.slightlyPositive },
        { key: "neutral",          label: "Neutral",             value: data.neutral,           color: COLOR.neutral },
        { key: "slightlyNegative", label: "Slightly Negative",   value: data.slightlyNegative,  color: COLOR.slightlyNegative },
        { key: "negative",         label: "Negative",            value: data.negative,          color: COLOR.negative },
        { key: "veryNegative",     label: "Very Negative",       value: data.veryNegative,      color: COLOR.veryNegative },
    ].filter(s => s.value > 0);

    let offset = 0;
    const arcs = slices.map(s => {
        const dash = (s.value / data.total) * CIRC;
        const arc = (
            <circle key={s.key} cx={CX} cy={CY} r={R}
                fill="none" stroke={s.color} strokeWidth="13"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${CX} ${CY})`}
            />
        );
        offset += dash;
        return arc;
    });

    // Score bar: -3 to +3 mapped to 0–100%
    const scorePct = Math.round(((data.averageScore + 3) / 6) * 100);
    const scoreColor = data.averageScore >= 0.25 ? "#059669" : data.averageScore >= -0.25 ? "#94A3B8" : "#DC2626";

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Donut with icon */}
            <div style={{ position: "relative", flexShrink: 0 }}>
                <svg viewBox={`0 0 ${CX * 2} ${CY * 2}`} width="84" height="84">
                    <circle cx={CX} cy={CY} r={R} fill="none" stroke="#F1F5F9" strokeWidth="13" />
                    {arcs}
                </svg>
                <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    pointerEvents: "none",
                }}>
                    <SentimentIcon group={data.overallGroup} size={26} />
                </div>
            </div>

            {/* Right side */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                {/* Overall label */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", marginBottom: 1 }}>
                    {GROUP_LABEL[data.overallGroup]}
                </div>

                {/* Average score bar */}
                <div style={{ marginBottom: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginBottom: 2 }}>
                        <span>Avg score</span>
                        <span style={{ color: scoreColor, fontWeight: 600 }}>
                            {data.averageScore > 0 ? "+" : ""}{data.averageScore.toFixed(2)}
                        </span>
                    </div>
                    <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                            height: "100%", width: `${scorePct}%`,
                            background: scoreColor, borderRadius: 2,
                            transition: "width .4s ease",
                        }} />
                    </div>
                </div>

                {/* Compact legend — only non-zero */}
                {slices.map(s => (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B" }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        <span style={{ fontWeight: 500, color: "#0F172A", marginLeft: 2 }}>
                            {s.value}
                        </span>
                    </div>
                ))}
                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                    {data.total} conversation{data.total !== 1 ? "s" : ""}
                </div>
            </div>
        </div>
    );
};
