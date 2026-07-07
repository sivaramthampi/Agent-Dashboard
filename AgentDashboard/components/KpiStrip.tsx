import * as React from "react";
import { KpiTileData } from "../types";
import { KpiCard } from "./KpiCard";
import { KpiValues } from "../data/kpis";

export interface KpiStripProps {
    tiles: KpiTileData[];
    errorKeys: Set<string>;
    onToggle: (tileKey: string, optionKey: string) => void;
    kpi: KpiValues | null;
    isRefreshing?: boolean;
}

// Maps each KPI tile key to the corresponding field on KpiValues.
export const KpiStrip: React.FC<KpiStripProps> = ({ tiles, errorKeys, onToggle, kpi, isRefreshing }) => {
    const row1 = tiles.filter(t => t.row === 1);
    const row2 = tiles.filter(t => t.row === 2);



    return (
        <>
            <div className="ad-section-head">
                <h2>Volume &amp; Queue Health</h2>
            </div>
            <div className="ad-cards">
                {row1.map(tile => (
                    <KpiCard key={tile.key} tile={tile} hasError={errorKeys.has(tile.key)} onToggle={onToggle} isRefreshing={isRefreshing} />
                ))}
            </div>

            <div className="ad-cards ad-cards-secondary">
                {row2.map(tile => (
                    <KpiCard key={tile.key} tile={tile} hasError={errorKeys.has(tile.key)} onToggle={onToggle} isRefreshing={isRefreshing} />
                ))}
            </div>
        </>
    );
};
