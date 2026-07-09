import * as React from "react"; // React used for JSX
import { AgentWrapupRow } from "../../data/agents";
import { SortableHeader } from "./SortableHeader";
import { numberComparator, stringComparator, useSortableRows } from "../../data/sortUtils";

function fmt(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function rowAlertClass(avgWrapup: number): string {
    if (avgWrapup > 600) return "ad-row-long";
    if (avgWrapup > 300) return "ad-row-watch";
    return "";
}

function Initials({ name }: { name: string }) {
    const parts = name.trim().split(" ");
    const ini = parts.length >= 2
        ? parts[0][0] + parts[parts.length - 1][0]
        : name.slice(0, 2);
    return <>{ini.toUpperCase()}</>;
}

// Generate a consistent colour per agent from their name
const AVATAR_COLORS = [
    { bg: "rgba(219,234,254,.8)", color: "#1D4ED8" },
    { bg: "rgba(220,252,231,.8)", color: "#065F46" },
    { bg: "rgba(237,233,254,.8)", color: "#5B21B6" },
    { bg: "rgba(254,243,199,.8)", color: "#92400E" },
    { bg: "rgba(255,228,230,.8)", color: "#9F1239" },
    { bg: "rgba(204,251,241,.8)", color: "#065666" },
    { bg: "rgba(255,237,213,.8)", color: "#9A3412" },
];
function avatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AgentAvatar({ name }: { name: string }) {
    const col = avatarColor(name);
    return (
        <div className="ad-avatar" style={{ background: col.bg, color: col.color }}>
            <Initials name={name} />
        </div>
    );
}

interface Props { rows: AgentWrapupRow[]; isLoading: boolean; }

const COMPARATORS = {
    agent:   stringComparator<AgentWrapupRow>(r => r.agentName),
    convs:   numberComparator<AgentWrapupRow>(r => r.conversations),
    avgHandle:   numberComparator<AgentWrapupRow>(r => r.avgHandleSec),
    totalHandle: numberComparator<AgentWrapupRow>(r => r.totalHandleSec),
    avgWrapup:   numberComparator<AgentWrapupRow>(r => r.avgWrapupSec),
    totalWrapup: numberComparator<AgentWrapupRow>(r => r.totalWrapupSec),
    sentiment:   numberComparator<AgentWrapupRow>(r => r.avgSentiment ?? -Infinity),
};

export const AgentWrapupTable: React.FC<Props> = ({ rows, isLoading }) => {
    // Default sort: avg wrap-up time, ascending (lowest first)
    const { sortedRows, sortKey, direction, onSort } = useSortableRows(rows, COMPARATORS, "avgWrapup", "asc");

    return (
    <div className="ad-panel">
        <div className="ad-panel-head">
            <h3>Agent Stats</h3>
            <span className="ad-panel-meta">Today</span>
        </div>
        <div className="ad-table-scroll ad-table-scroll-lg">
            <table className="ad-table ad-stats-table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "9%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <SortableHeader label="Agent" sortKey="agent" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Convs" sortKey="convs" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        <SortableHeader label="Avg Handle" sortKey="avgHandle" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        <SortableHeader label="Total Handle" sortKey="totalHandle" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        <SortableHeader label="Avg Wrap-up" sortKey="avgWrapup" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        <SortableHeader label="Total Wrap-up" sortKey="totalWrapup" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        <SortableHeader label="Sentiment" sortKey="sentiment" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                    </tr>
                </thead>
                <tbody>
                    {isLoading && <tr><td colSpan={7} className="ad-table-empty">Loading…</td></tr>}
                    {!isLoading && sortedRows.length === 0 && (
                        <tr><td colSpan={7} className="ad-table-empty">No data for this period</td></tr>
                    )}
                    {!isLoading && sortedRows.map((row) => (
                        <tr key={row.agentId} className={rowAlertClass(row.avgWrapupSec)}>
                            <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <AgentAvatar name={row.agentName} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {row.agentName}
                                    </span>
                                </div>
                            </td>
                            <td>{row.conversations}</td>
                            <td className="ad-mono">{fmt(row.avgHandleSec)}</td>
                            <td className="ad-mono">{fmt(row.totalHandleSec)}</td>
                            <td className="ad-mono">{fmt(row.avgWrapupSec)}</td>
                            <td className="ad-mono">{fmt(row.totalWrapupSec)}</td>
                            <td style={{
                                fontWeight: 500, fontSize: 11,
                                color: row.avgSentiment === null ? "#94A3B8"
                                    : row.avgSentiment >= 0.25 ? "#16A34A"
                                    : row.avgSentiment <= -0.25 ? "#DC2626"
                                    : "#475569"
                            }}>
                                {row.avgSentiment === null ? "—"
                                    : `${row.avgSentiment >= 0 ? "+" : ""}${row.avgSentiment.toFixed(1)}`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        <div className="ad-table-legend">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(250,238,218,.6)", display: "inline-block" }} />
            <span>5–10 min wrap-up</span>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(252,235,235,.7)", borderLeft: "2px solid #E24B4A", display: "inline-block" }} />
            <span>&gt;10 min wrap-up</span>
        </div>
    </div>
    );
};
