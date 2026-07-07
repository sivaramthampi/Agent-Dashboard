import * as React from "react";
import { AgentRow } from "../../types";
import { PresenceBreakdownItem } from "../../data/agents";

export interface AgentListTableProps {
    rows: AgentRow[];
    isLoading: boolean;
    presenceBreakdown: PresenceBreakdownItem[];
}

const STATUS_CLASS: Record<string, string> = {
    "Available":  "available",
    "Busy":       "busy",
    "Busy - DND": "busy",
    "Away":       "away",
    "Wrap-up":    "wrapup",
};

const PRESENCE_COLOR: Record<string, string> = {
    "available":    "#22C55E",
    "busy - dnd":   "#EF4444",
    "busydnd":       "#EF4444",
    "busy":         "#EF4444",
    "away":         "#F59E0B",
    "be right back":"#F59E0B",
    "offline":      "#94A3B8",
    "project":      "#818CF8",
};

function durationMinutes(durationStr: string): number {
    const parts = durationStr.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 60 + parts[1];
    if (parts.length === 2) return parts[0];
    return 0;
}

function rowAlertClass(durationStr: string): string {
    const mins = durationMinutes(durationStr);
    if (mins >= 30) return "ad-row-long";
    if (mins >= 15) return "ad-row-watch";
    return "";
}

// Fixed 5 presence states always shown in order — even if count is 0
// `matches` lists the raw (lowercased) presence values that count toward this card;
// used for both the displayed count AND the click-to-filter behavior, so the two stay in sync.
const STRIP_STATES = [
    { key: "available", label: "Available", color: "#22C55E", matches: ["available"] },
    { key: "busy",      label: "Busy",      color: "#EF4444", matches: ["busy", "busy - dnd", "busydnd"] },
    { key: "busydnd",   label: "BusyDND",   color: "#EF4444", matches: ["busydnd"] },
    { key: "away",      label: "Away",      color: "#F59E0B", matches: ["away"] },
    { key: "project",   label: "Project",   color: "#818CF8", matches: ["project"] },
];

export const AgentListTable: React.FC<AgentListTableProps> = ({ rows, isLoading, presenceBreakdown }) => {
    // Which stat card (if any) is currently active as a filter. Single-select —
    // clicking the active card again clears it (toggle off).
    const [activeKey, setActiveKey] = React.useState<string | null>(null);

    // Merge busy + busy-dnd for the strip
    // Build count map from presenceBreakdown
    const countMap = new Map<string, number>();
    presenceBreakdown.forEach(p => countMap.set(p.presence.toLowerCase(), p.count));
    // Always show all 5 states in fixed order, count defaults to 0
    const stripItems = STRIP_STATES.map(s => ({
        key: s.key,
        label: s.label,
        color: s.color,
        matches: s.matches,
        // merge busy-dnd into busy count
        count: (countMap.get(s.key) ?? 0) +
               (s.key === "busy" ? (countMap.get("busy - dnd") ?? 0) + (countMap.get("busydnd") ?? 0) : 0),
    }));

    const activeState = stripItems.find(s => s.key === activeKey) ?? null;
    const visibleRows = activeState
        ? rows.filter(r => activeState.matches.includes(r.status.toLowerCase()))
        : rows;

    const totalLoggedIn = rows.length;

    const handleCardClick = (key: string) => {
        setActiveKey(prev => (prev === key ? null : key));
    };

    return (
        <div className="ad-panel">
            <div className="ad-panel-head">
                <h3>Agent List</h3>
                <span className="ad-panel-meta">
                    {activeState
                        ? `${visibleRows.length} of ${totalLoggedIn} ${activeState.label}`
                        : `${totalLoggedIn} logged in`}
                    {activeState && (
                        <button
                            type="button"
                            className="ad-filter-clear"
                            onClick={() => setActiveKey(null)}
                            aria-label="Clear filter"
                        >
                            Clear ✕
                        </button>
                    )}
                </span>
            </div>
            {/* Presence stat strip — click a card to filter the table to that status */}
            <div className="ad-agent-stat-strip">
                {stripItems.map(s => (
                    <div
                        key={s.label}
                        className={`ad-agent-stat ad-agent-stat-clickable${activeKey === s.key ? " ad-agent-stat-active" : ""}`}
                        onClick={() => handleCardClick(s.key)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={activeKey === s.key}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(s.key); } }}
                    >
                        <div className="ad-agent-stat-num" style={{ color: s.color }}>{s.count}</div>
                        <div className="ad-agent-stat-lbl">{s.label}</div>
                    </div>
                ))}
            </div>
            <div className="ad-table-scroll ad-table-scroll-lg">
                <table className="ad-table">
                    <thead>
                        <tr>
                            <th>Agent</th>
                            <th>Status</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && <tr><td colSpan={3} className="ad-table-empty">Loading…</td></tr>}
                        {!isLoading && visibleRows.length === 0 && (
                            <tr><td colSpan={3} className="ad-table-empty">
                                {activeState ? `No agents in "${activeState.label}"` : "No agents online"}
                            </td></tr>
                        )}
                        {!isLoading && visibleRows.map(row => (
                            <tr key={row.id} className={rowAlertClass(row.duration)}>
                                <td>{row.name ?? row.id}</td>
                                <td>
                                    <span className={`ad-badge ${STATUS_CLASS[row.status] ?? "default"}`}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="ad-mono">{row.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="ad-table-legend">
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(250,238,218,.6)", display: "inline-block" }} />
                <span>15–30 min in status</span>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(252,235,235,.7)", borderLeft: "2px solid #E24B4A", display: "inline-block" }} />
                <span>&gt;30 min in status</span>
            </div>
        </div>
    );
};