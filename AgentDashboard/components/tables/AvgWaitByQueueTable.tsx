import * as React from "react";
import { QueueWaitRow } from "../../types";

export interface AvgWaitByQueueTableProps {
    rows: QueueWaitRow[];
    isLoading: boolean;
}

export const AvgWaitByQueueTable: React.FC<AvgWaitByQueueTableProps> = ({ rows, isLoading }) => {
    return (
        <div className="ad-panel">
            <div className="ad-panel-head">
                <h3>Avg First Wait Time by Queue</h3>
            </div>
            <div className="ad-table-scroll ad-table-scroll-lg">
                <table className="ad-table">
                    <tbody>
                        {isLoading && (
                            <tr><td colSpan={2} className="ad-table-empty">Loading…</td></tr>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <tr><td colSpan={2} className="ad-table-empty">No data for this period</td></tr>
                        )}
                        {!isLoading && rows.map(row => (
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
