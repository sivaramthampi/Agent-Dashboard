import * as React from "react";
import { ConversationRow, AgentRow } from "../../types";
import { PresenceBreakdownItem } from "../../data/agents";
import { OngoingConversationsTable } from "./OngoingConversationsTable";
import { AgentListTable } from "./AgentListTable";

export interface TablesSectionProps {
    conversations: ConversationRow[];
    conversationsLoading: boolean;
    conversationsError: boolean;
    selectedRowId: string | null;
    onSelectRow: (id: string | null) => void;
    agents: AgentRow[];
    agentsLoading: boolean;
    presenceBreakdown: PresenceBreakdownItem[];
}

export const TablesSection: React.FC<TablesSectionProps> = (props) => {
    return (
        <div className="ad-tables">
            <OngoingConversationsTable
                rows={props.conversations}
                isLoading={props.conversationsLoading}
                hasError={props.conversationsError}
                selectedRowId={props.selectedRowId}
                onSelectRow={props.onSelectRow}
            />
            <div className="ad-tables-side">
                <AgentListTable rows={props.agents} isLoading={props.agentsLoading} presenceBreakdown={props.presenceBreakdown} />
            </div>
        </div>
    );
};
