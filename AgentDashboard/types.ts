// ===== KPI tiles =====
export interface KpiToggleOption {
    key: string;
    label: string;
}

export interface KpiTileData {
    key: string;
    label: string;
    icon: string;
    cssClass: string;
    row: 1 | 2;
    displayValue: string | null;
    sub?: string;
    isMock?: boolean;
    toggle?: {
        options: KpiToggleOption[];
        activeKey: string;
    };
}

// ===== Ongoing Conversations table =====
export interface ConversationRow {
    id: string;
    contactName: string;
    status: string;
    activeAgent: string;
    queue: string;
    lastModified: string;
    direction: "Inbound" | "Outbound";
}

// ===== Agent List table =====
export interface AgentRow {
    id: string;
    name: string;
    status: string;
    duration: string;
}

// ===== Avg First Wait Time by Queue table =====
export interface QueueWaitRow {
    queue: string;
    avgWait: string;
}

// ===== Filters =====
export interface FilterOption {
    key: string;
    label: string;
}

export interface FilterDef {
    key: string;
    label: string;
    mode: "single" | "multi";
    options: FilterOption[];
    selectedKeys: Set<string>;
}
