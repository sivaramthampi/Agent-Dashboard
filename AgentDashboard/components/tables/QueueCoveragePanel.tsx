import * as React from "react";
import { AgentRow } from "../../types";
import { QueueWaitRow } from "../../types";

interface Props {
    agents: AgentRow[];
    queueWait: QueueWaitRow[];
    isLoading: boolean;
}

export const QueueCoveragePanel: React.FC<Props> = ({ agents, queueWait, isLoading }) => {
    // Count available agents per queue using agent presence
    // We don't have per-agent queue assignment in snapshot, so show queue wait + flag zeros
    const rows = queueWait.map(q => {
        const availableAgents = agents.filter(a =>
            a.status.toLowerCase().includes("available")
        ).length;
        // We show queue wait + available agent count as a proxy
        return { queue: q.queue, avgWait: q.avgWait };
    });

    if (isLoading) return null;
    if (rows.length === 0) return null;

    return (
        <div className="ad-panel">
            <div className="ad-panel-head">
                <h3>Queue Coverage</h3>
                <span className="ad-panel-meta">Avg wait · queues with no data flagged</span>
            </div>
            <div className="ad-panel-body">
                <div className="ad-queue-coverage-grid">
                    {rows.map(r => (
                        <div key={r.queue}
                            className={`ad-queue-item ${r.avgWait === "—" ? "ad-queue-no-data" : ""}`}>
                            <span className="ad-queue-name">{r.queue}</span>
                            <span className={`ad-queue-wait ${r.avgWait === "—" ? "ad-text-faint" : ""}`}>
                                {r.avgWait}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
