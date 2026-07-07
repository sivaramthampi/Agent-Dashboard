import * as React from "react";
import { KpiTileData } from "../types";

export interface KpiCardProps {
    tile: KpiTileData;
    hasError: boolean;
    onToggle?: (tileKey: string, optionKey: string) => void;
    isRefreshing?: boolean;
}

/**
 * Renders one KPI tile. Still a "presentational" component — no fetching,
 * no polling — but now also handles the optional inline toggle (used by
 * Avg. Handle Time to switch between Conversation/Session without needing
 * two separate KPI cards), and an optional yesterday-comparison delta line.
 */
export const KpiCard: React.FC<KpiCardProps> = ({ tile, hasError, onToggle, isRefreshing }) => {
    const isLoading = tile.displayValue === null && !hasError;

    if (tile.key === "sentiment") {
        return (
            <div className={`ad-card ${tile.cssClass}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                {isRefreshing && <div className="ad-kpi-refresh-bar" />}
                <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{tile.icon}</div>
                <div className="ad-card-title" style={{ fontSize: 10, paddingRight: 0, marginBottom: 4 }}>{tile.label}</div>
                <div className="ad-card-value" style={{ fontSize: 20, color: "#065F46" }}>
                    {isLoading ? "…" : hasError ? "--" : tile.displayValue}
                </div>
                {tile.sub && !isLoading && !hasError && (
                    <div className="ad-card-sub" style={{ color: "#065F46", opacity: .75, marginTop: 3 }}>{tile.sub}</div>
                )}
            </div>
        );
    }

    return (
        <div className={`ad-card ${tile.cssClass}`}>
            {isRefreshing && <div className="ad-kpi-refresh-bar" />}
            <div className="ad-card-icon">{tile.icon}</div>
            <div className="ad-card-title">{tile.label}</div>
            <div className={`ad-card-value${isLoading ? " is-loading" : ""}`}>
                {hasError ? "--" : isLoading ? "Loading…" : tile.displayValue}
            </div>
            {tile.sub && !isLoading && !hasError && (
                <div className="ad-card-sub">{tile.sub}</div>
            )}
            {tile.toggle && (
                <div className="ad-card-toggle">
                    {tile.toggle.options.map(opt => (
                        <button
                            key={opt.key}
                            className={opt.key === tile.toggle!.activeKey ? "active" : ""}
                            onClick={() => onToggle?.(tile.key, opt.key)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
