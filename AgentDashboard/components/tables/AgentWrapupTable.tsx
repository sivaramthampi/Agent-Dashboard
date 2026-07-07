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

function scoreClass(score: number): string {
    if (score >= 75) return "ad-score-green";
    if (score >= 50) return "ad-score-amber";
    return "ad-score-red";
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

function AgentAvatar({ name, rank }: { name: string; rank: string }) {
    const col = avatarColor(name);
    return (
        <div className={`ad-avatar ${rank ? `ad-avatar-glow-${rank}` : ""}`}
             style={{ background: col.bg, color: col.color }}>
            <Initials name={name} />
        </div>
    );
}


function rankClass(idx: number): string {
    if (idx === 0) return "ad-rank-1";
    if (idx === 1) return "ad-rank-2";
    if (idx === 2) return "ad-rank-3";
    return "";
}

function rankWatermark(idx: number): string {
    if (idx === 0) return "1";
    if (idx === 1) return "2";
    if (idx === 2) return "3";
    return "";
}

interface Props { rows: AgentWrapupRow[]; isLoading: boolean; }

// Rows arrive pre-sorted by performanceScore (desc) from the data layer — that
// order is what drives the gold/silver/bronze medal styling. We freeze that as
// `_rank` before the user applies any column sort, so the medals always refer
// to the actual leaderboard position regardless of how the table is displayed.
type RankedRow = AgentWrapupRow & { _rank: number };

const COMPARATORS = {
    agent:   stringComparator<RankedRow>(r => r.agentName),
    convs:   numberComparator<RankedRow>(r => r.conversations),
    avgHandle:   numberComparator<RankedRow>(r => r.avgHandleSec),
    totalHandle: numberComparator<RankedRow>(r => r.totalHandleSec),
    avgWrapup:   numberComparator<RankedRow>(r => r.avgWrapupSec),
    totalWrapup: numberComparator<RankedRow>(r => r.totalWrapupSec),
    sentiment:   numberComparator<RankedRow>(r => r.avgSentiment ?? -Infinity),
    score:       numberComparator<RankedRow>(r => r.performanceScore),
};

export const AgentWrapupTable: React.FC<Props> = ({ rows, isLoading }) => {
    const rankedRows: RankedRow[] = React.useMemo(
        () => rows.map((r, idx) => ({ ...r, _rank: idx })),
        [rows]
    );
    const { sortedRows, sortKey, direction, onSort } = useSortableRows(rankedRows, COMPARATORS);

    return (
    <div className="ad-panel">
        <div className="ad-panel-head">
            <h3>Agent Stats</h3>
            <span className="ad-panel-meta">Today</span>
        </div>
        <div className="ad-table-scroll ad-table-scroll-lg">
            <table className="ad-table ad-stats-table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "8%" }} />
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
                        <SortableHeader label="Score" sortKey="score" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                    </tr>
                </thead>
                <tbody>
                    {isLoading && <tr><td colSpan={8} className="ad-table-empty">Loading…</td></tr>}
                    {!isLoading && sortedRows.length === 0 && (
                        <tr><td colSpan={8} className="ad-table-empty">No data for this period</td></tr>
                    )}
                    {!isLoading && sortedRows.map((row) => (
                        <tr key={row.agentId} className={[rowAlertClass(row.avgWrapupSec), rankClass(row._rank)].filter(Boolean).join(" ")}>
                            <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <AgentAvatar name={row.agentName} rank={rankClass(row._rank).replace("ad-rank-","")} />
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {row.agentName}
                                    </span>
                                    {rankWatermark(row._rank) && (
                                        <span className="ad-rank-watermark">{rankWatermark(row._rank)}</span>
                                    )}
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
                            <td>
                                <span className={`ad-score ${scoreClass(row.performanceScore)}`}>
                                    {row.performanceScore}
                                </span>
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
