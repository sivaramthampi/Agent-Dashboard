import * as React from "react";
import { QueueWaitRow } from "../../types";
import { SortableHeader } from "./SortableHeader";
import { durationComparator, stringComparator, useSortableRows } from "../../data/sortUtils";

export interface AvgWaitByQueueTableProps {
    rows: QueueWaitRow[];
    isLoading: boolean;
}

const COMPARATORS = {
    queue: stringComparator<QueueWaitRow>(r => r.queue),
    wait:  durationComparator<QueueWaitRow>(r => r.avgWait),
};

export const AvgWaitByQueueTable: React.FC<AvgWaitByQueueTableProps> = ({ rows, isLoading }) => {
    const { sortedRows, sortKey, direction, onSort } = useSortableRows(rows, COMPARATORS);
    return (
        <div className="ad-panel">
            <div className="ad-panel-head">
                <h3>Avg First Wait Time by Queue</h3>
            </div>
            <div className="ad-table-scroll ad-table-scroll-lg">
                <table className="ad-table">
                    <thead>
                        <tr>
                            <SortableHeader label="Queue" sortKey="queue" activeKey={sortKey} direction={direction} onSort={onSort} />
                            <SortableHeader label="Avg Wait" sortKey="wait" activeKey={sortKey} direction={direction} onSort={onSort} align="right" />
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={2} className="ad-table-empty">Loading…</td></tr>
                        )}
                        {!isLoading && sortedRows.length === 0 && (
                            <tr><td colSpan={2} className="ad-table-empty">No data for this period</td></tr>
                        )}
                        {!isLoading && sortedRows.map(row => (
                            <tr key={row.queue}>
                                <td>{row.queue}</td>
                                <td className="ad-mono ad-align-right">{row.avgWait}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
