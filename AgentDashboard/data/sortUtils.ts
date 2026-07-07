import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

// Parses "mm:ss" / "h:mm:ss" duration strings (as produced by formatSeconds)
// into seconds for numeric sorting. "—" / empty / unparsable → -1 so those
// rows always sort to the bottom regardless of direction.
export function parseDurationToSeconds(value: string | undefined | null): number {
    if (!value || value === "—") return -1;
    const parts = value.split(":").map(Number);
    if (parts.some(p => isNaN(p))) return -1;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
}

export type Comparator<T> = (a: T, b: T) => number;

export function stringComparator<T>(getValue: (row: T) => string): Comparator<T> {
    return (a, b) => getValue(a).localeCompare(getValue(b));
}

export function numberComparator<T>(getValue: (row: T) => number): Comparator<T> {
    return (a, b) => getValue(a) - getValue(b);
}

export function durationComparator<T>(getValue: (row: T) => string): Comparator<T> {
    return (a, b) => parseDurationToSeconds(getValue(a)) - parseDurationToSeconds(getValue(b));
}

// Generic click-to-sort state + derived sorted rows.
// `comparators` maps a column key -> comparator for that column.
// Rows are always sorted with a stable copy (never mutates the input array).
export function useSortableRows<T>(
    rows: T[],
    comparators: Record<string, Comparator<T>>,
    defaultKey: string | null = null,
    defaultDirection: SortDirection = "asc"
) {
    const [sortKey, setSortKey] = useState<string | null>(defaultKey);
    const [direction, setDirection] = useState<SortDirection>(defaultDirection);

    function onSort(key: string) {
        if (!comparators[key]) return;
        if (key === sortKey) {
            setDirection(d => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setDirection("asc");
        }
    }

    const sortedRows = useMemo(() => {
        if (!sortKey || !comparators[sortKey]) return rows;
        const cmp = comparators[sortKey];
        const copy = [...rows].sort(cmp);
        return direction === "asc" ? copy : copy.reverse();
    }, [rows, sortKey, direction, comparators]);

    return { sortedRows, sortKey, direction, onSort };
}
