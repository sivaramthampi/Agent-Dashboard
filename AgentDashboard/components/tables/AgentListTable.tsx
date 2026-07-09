import * as React from "react";
import { AgentRow } from "../../types";
import { PresenceBreakdownItem } from "../../data/agents";
import { SortableHeader } from "./SortableHeader";
import { durationComparator, stringComparator, useSortableRows } from "../../data/sortUtils";

export interface AgentListTableProps {
    rows: AgentRow[];
    isLoading: boolean;
    presenceBreakdown: PresenceBreakdownItem[];
}

// Agent rows are filtered upstream (data/agents.ts) so status is either one
// of these 5 canonical labels, or — for any other presence an agent might be
// in (break, lunch, meeting, etc.) — the raw presence display text. Those
// "other" statuses get a dynamic tile generated below rather than a fixed
// class here; they render with the "default" badge style as a fallback.
const STATUS_CLASS: Record<string, string> = {
    "Available": "available",
    "Busy":      "busy",
    "BusyDND":   "busy",
    "Away":      "away",
    "Project":   "project",
};

const PRESENCE_COLOR: Record<string, string> = {
    "available":    "#22C55E",
    "busydnd":       "#EF4444",
    "busy":         "#EF4444",
    "away":         "#F59E0B",
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

// These 5 are static — always shown, even with a count of 0.
const STATIC_STATES = [
    { key: "available", label: "Available", color: "#22C55E", matches: ["available"] },
    { key: "busy",      label: "Busy",      color: "#EF4444", matches: ["busy"] },
    { key: "busydnd",   label: "BusyDND",   color: "#EF4444", matches: ["busydnd"] },
    { key: "away",      label: "Away",      color: "#F59E0B", matches: ["away"] },
    { key: "project",   label: "Project",   color: "#818CF8", matches: ["project"] },
];
const STATIC_KEYS = new Set(STATIC_STATES.map(s => s.key));

const COMPARATORS = {
    name:     stringComparator<AgentRow>(r => r.name ?? r.id),
    status:   stringComparator<AgentRow>(r => r.status),
    duration: durationComparator<AgentRow>(r => r.duration),
};

export const AgentListTable: React.FC<AgentListTableProps> = ({ rows, isLoading, presenceBreakdown }) => {
    // Which stat card (if any) is currently active as a filter. Single-select —
    // clicking the active card again clears it (toggle off).
    const [activeKey, setActiveKey] = React.useState<string | null>(null);

    // Build count map from presenceBreakdown
    const countMap = new Map<string, number>();
    presenceBreakdown.forEach(p => countMap.set(p.presence.toLowerCase(), p.count));

    // Any presence showing up that isn't one of the 5 static ones gets its
    // own dynamic tile — only added when at least one agent is actually in
    // that status, using its raw display text as both label and match key.
    const dynamicStates = presenceBreakdown
        .filter(p => !STATIC_KEYS.has(p.presence.toLowerCase()))
        .map(p => ({
            key: p.presence.toLowerCase(),
            label: p.presence,
            color: "#94A3B8", // neutral slate — these aren't primary tracked states
            matches: [p.presence.toLowerCase()],
        }));

    // Always show all 5 static states in fixed order (count defaults to 0),
    // followed by any dynamic "other" tiles currently in use.
    const stripItems = [...STATIC_STATES, ...dynamicStates].map(s => ({
        key: s.key,
        label: s.label,
        color: s.color,
        matches: s.matches,
        count: countMap.get(s.key) ?? 0,
    }));

    const activeState = stripItems.find(s => s.key === activeKey) ?? null;
    const visibleRows = activeState
        ? rows.filter(r => activeState.matches.includes(r.status.toLowerCase()))
        : rows;

    const { sortedRows, sortKey, direction, onSort } = useSortableRows(visibleRows, COMPARATORS);

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
                            <SortableHeader label="Agent" sortKey="name" activeKey={sortKey} direction={direction} onSort={onSort} />
                            <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={onSort} />
                            <SortableHeader label="Duration" sortKey="duration" activeKey={sortKey} direction={direction} onSort={onSort} />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && <tr><td colSpan={3} className="ad-table-empty">Loading…</td></tr>}
                        {!isLoading && visibleRows.length === 0 && (
                            <tr><td colSpan={3} className="ad-table-empty">
                                {activeState ? `No agents in "${activeState.label}"` : "No agents online"}
                            </td></tr>
                        )}
                        {!isLoading && sortedRows.map(row => (
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