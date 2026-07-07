import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { FilterDef } from "../../types";

export interface FilterDropdownProps {
    def: FilterDef;
    onChange: (key: string, selectedKeys: Set<string>) => void;
}

/**
 * One filter control. Two modes:
 *  - "single": clicking an option replaces the selection (e.g. Time: Today / Yesterday / ...)
 *  - "multi":  clicking an option toggles it on/off, plus a "Select all" row
 *
 * `open` is local state — only this dropdown knows whether it's expanded.
 * The actual *selection* lives in the parent (App) via `onChange`, since
 * that's the value other parts of the dashboard will eventually need to
 * read (once real filtering is wired up).
 */
export const FilterDropdown: React.FC<FilterDropdownProps> = ({ def, onChange }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Close the dropdown when clicking anywhere outside it.
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const allSelected = def.selectedKeys.size === def.options.length;

    function toggleOption(optionKey: string) {
        if (def.mode === "single") {
            onChange(def.key, new Set([optionKey]));
            setOpen(false);
            return;
        }
        const next = new Set(def.selectedKeys);
        if (next.has(optionKey)) {
            next.delete(optionKey);
        } else {
            next.add(optionKey);
        }
        onChange(def.key, next);
    }

    function toggleSelectAll() {
        onChange(def.key, allSelected ? new Set() : new Set(def.options.map(o => o.key)));
    }

    // Button label: single-select shows the chosen option's label;
    // multi-select shows "All" / "None" / "N selected".
    let summary: string;
    if (def.mode === "single") {
        summary = def.options.find(o => def.selectedKeys.has(o.key))?.label ?? "—";
    } else if (def.options.length === 0) {
        summary = "Loading…";
    } else if (allSelected) {
        summary = `All (${def.options.length})`;
    } else if (def.selectedKeys.size === 0) {
        summary = "None";
    } else {
        summary = `${def.selectedKeys.size} of ${def.options.length}`;
    }

    return (
        <div className={`ad-filter${open ? " ad-filter-open" : ""}`} ref={rootRef}>
            <button className="ad-filter-btn" onClick={() => setOpen(o => !o)}>
                <span className="ad-filter-label">{def.label}</span>
                <span className="ad-filter-value">{summary}</span>
                <svg viewBox="0 0 10 6" width="10" height="6" fill="none">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </button>

            {open && (
                <div className="ad-filter-dropdown">
                    {def.mode === "multi" && (
                        <>
                            <div
                                className={`ad-filter-item${allSelected ? " ad-filter-item-checked" : ""}`}
                                onClick={toggleSelectAll}
                            >
                                <span className="ad-filter-box" />
                                Select all
                            </div>
                            <div className="ad-filter-divider" />
                        </>
                    )}
                    {def.options.map(opt => {
                        const checked = def.selectedKeys.has(opt.key);
                        return (
                            <div
                                key={opt.key}
                                className={`ad-filter-item${checked ? " ad-filter-item-checked" : ""}`}
                                onClick={() => toggleOption(opt.key)}
                            >
                                <span className="ad-filter-box" />
                                {opt.label}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
