import * as React from "react";
import { ConversationRow, AgentRow } from "../../types";
import { PresenceBreakdownItem } from "../../data/agents";
import { StatusBreakdownItem } from "../../data/statusBreakdown";
import { OngoingConversationsTable } from "./OngoingConversationsTable";
import { AgentListTable } from "./AgentListTable";
import { StatusBreakdownChart } from "../charts/StatusBreakdownChart";

export interface TablesSectionProps {
    conversations: ConversationRow[];
    conversationsLoading: boolean;
    conversationsError: boolean;
    selectedRowId: string | null;
    onSelectRow: (id: string | null) => void;
    agents: AgentRow[];
    agentsLoading: boolean;
    presenceBreakdown: PresenceBreakdownItem[];
    statusBreakdown: StatusBreakdownItem[];
    statusLoading: boolean;
}

export const TablesSection: React.FC<TablesSectionProps> = (props) => {
    return (
        <>
            {/* Full-width row */}
            <OngoingConversationsTable
                rows={props.conversations}
                isLoading={props.conversationsLoading}
                hasError={props.conversationsError}
                selectedRowId={props.selectedRowId}
                onSelectRow={props.onSelectRow}
            />
            {/* Agent List (wide) + Ongoing by Status (side) */}
            <div className="ad-tables">
                <AgentListTable rows={props.agents} isLoading={props.agentsLoading} presenceBreakdown={props.presenceBreakdown} />
                <div className="ad-tables-side">
                    <div className="ad-panel">
                        <div className="ad-panel-head"><h3>Ongoing by Status</h3></div>
                        <div className="ad-panel-body">
                            <StatusBreakdownChart items={props.statusBreakdown} isLoading={props.statusLoading} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
