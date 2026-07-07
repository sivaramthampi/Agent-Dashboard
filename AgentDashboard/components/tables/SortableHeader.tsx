import * as React from "react";
import { SortDirection } from "../../data/sortUtils";

export interface SortableHeaderProps {
    label: string;
    sortKey: string;
    activeKey: string | null;
    direction: SortDirection;
    onSort: (key: string) => void;
    align?: "left" | "right";
}

// Clickable <th> with an up/down arrow indicator. Inactive columns show a
// neutral ⇅ glyph so it's discoverable that the column is sortable at all.
export const SortableHeader: React.FC<SortableHeaderProps> = ({
    label, sortKey, activeKey, direction, onSort, align
}) => {
    const isActive = activeKey === sortKey;
    return (
        <th
            className={`ad-th-sortable${align === "right" ? " ad-align-right" : ""}`}
            onClick={() => onSort(sortKey)}
            role="button"
            tabIndex={0}
            aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
            onKeyDown={e => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSort(sortKey); }
            }}
        >
            <span className="ad-th-sortable-inner">
                {label}
                <span className={`ad-sort-arrow${isActive ? " ad-sort-arrow-active" : ""}`}>
                    {isActive ? (direction === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
                </span>
            </span>
        </th>
    );
};
