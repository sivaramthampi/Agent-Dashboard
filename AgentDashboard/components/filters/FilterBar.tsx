import * as React from "react";
import { FilterDef } from "../../types";
import { FilterDropdown } from "./FilterDropdown";

export interface FilterBarProps {
    filters: FilterDef[];
    onFilterChange: (key: string, selectedKeys: Set<string>) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onFilterChange }) => {
    const timeFilter = filters.find(f => f.key === "time");
    const agentFilter = filters.find(f => f.key === "agent");
    const otherFilters = filters.filter(f => f.key !== "time" && f.key !== "agent");

    return (
        <div className="ad-filterbar">
            <span className="ad-filterbar-label">Filter</span>
            {timeFilter && <FilterDropdown def={timeFilter} onChange={onFilterChange} />}
            {otherFilters.map(f => (
                <FilterDropdown key={f.key} def={f} onChange={onFilterChange} />
            ))}
            {agentFilter && (
                <>
                    <div className="ad-filterbar-divider" />
                    <span className="ad-filterbar-label">Agent</span>
                    <FilterDropdown def={agentFilter} onChange={onFilterChange} />
                </>
            )}
        </div>
    );
};
