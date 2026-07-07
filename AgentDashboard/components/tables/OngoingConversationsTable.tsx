import * as React from "react";
import { ConversationRow } from "../../types";
import { SortableHeader } from "./SortableHeader";
import { durationComparator, stringComparator, useSortableRows } from "../../data/sortUtils";

export interface OngoingConversationsTableProps {
    rows: ConversationRow[];
    isLoading: boolean;
    hasError: boolean;
    selectedRowId: string | null;
    onSelectRow: (id: string | null) => void;
}

const STATUS_CLASS: Record<string, string> = {
    "Active": "active",
    "Waiting": "waiting",
    "Wrap-up": "wrapup"
};

const COMPARATORS = {
    contact:   stringComparator<ConversationRow>(r => r.contactName),
    status:    stringComparator<ConversationRow>(r => r.status),
    agent:     stringComparator<ConversationRow>(r => r.activeAgent),
    queue:     stringComparator<ConversationRow>(r => r.queue),
    modified:  durationComparator<ConversationRow>(r => r.lastModified),
    direction: stringComparator<ConversationRow>(r => r.direction),
};

// Inline sentiment icon for table
export const OngoingConversationsTable: React.FC<OngoingConversationsTableProps> = ({
    rows, isLoading, hasError, selectedRowId, onSelectRow
}) => {
    const { sortedRows, sortKey, direction, onSort } = useSortableRows(rows, COMPARATORS);
    const selectedRow = rows.find(r => r.id === selectedRowId) ?? null;

    function handleRowClick(id: string) {
        // Clicking the already-selected row deselects it (toggle behavior),
        // same as the confirmed mockup.
        onSelectRow(id === selectedRowId ? null : id);
    }

    return (
        <div className="ad-panel ad-panel-wide">
            <div className="ad-panel-head">
                <h3>Ongoing Conversations</h3>
            </div>
            <div className="ad-table-scroll ad-table-scroll-lg">
            <table className="ad-table">
                <thead>
                    <tr>
                        <SortableHeader label="Contact" sortKey="contact" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Status" sortKey="status" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Active Agent" sortKey="agent" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Queue" sortKey="queue" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Last Modified" sortKey="modified" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <SortableHeader label="Direction" sortKey="direction" activeKey={sortKey} direction={direction} onSort={onSort} />
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading && (
                        <tr><td colSpan={7} className="ad-table-empty">Loading…</td></tr>
                    )}
                    {!isLoading && hasError && (
                        <tr><td colSpan={7} className="ad-table-empty ad-table-error">Couldn't load conversations</td></tr>
                    )}
                    {!isLoading && !hasError && rows.length === 0 && (
                        <tr><td colSpan={7} className="ad-table-empty">No ongoing conversations</td></tr>
                    )}
                    {!isLoading && !hasError && sortedRows.map(row => {
                        const parts = row.lastModified.split(":").map(Number);
                        const mins = parts.length >= 2 ? (parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0]) : 0;
                        const isUnassigned = row.activeAgent === "Unassigned";
                        const alertClass = isUnassigned && mins >= 5 ? "ad-row-unassigned"
                            : mins >= 3 ? "ad-row-alert"
                            : mins >= 1 ? "ad-row-warn" : "";
                        const selClass = row.id === selectedRowId ? "ad-row-selected" : "";
                        return (
                        <tr
                            key={row.id}
                            className={[alertClass, selClass].filter(Boolean).join(" ")}
                            onClick={() => handleRowClick(row.id)}
                        >
                            <td>{row.contactName}</td>
                            <td>
                                <span className={`ad-badge ${STATUS_CLASS[row.status] ?? "default"}`}>
                                    {row.status}
                                </span>
                            </td>
                            <td>{row.activeAgent}</td>
                            <td>{row.queue}</td>
                            <td className="ad-mono">{row.lastModified}</td>
                            <td>{row.direction === "Inbound" ? "\u2193 Inbound" : "\u2191 Outbound"}</td>
                            <td>
                                <button
                                    className="ad-open-btn"
                                    title="Open record"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (window as any).Xrm?.Navigation?.openForm({
                                            entityName: "msdyn_ocliveworkitem",
                                            entityId: row.id,
                                        });
                                    }}
                                >↗</button>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
            </div>
        </div>
    );
};
