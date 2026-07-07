import * as React from "react";
import { TrendPoint } from "../../data/trend";
import { StatusBreakdownItem } from "../../data/statusBreakdown";
import { PresenceBreakdownItem } from "../../data/agents";
import { TrendChart } from "./TrendChart";
import { StatusBreakdownChart } from "./StatusBreakdownChart";
import { HourlyBarChart } from "./HourlyBarChart";
import { SentimentDonut } from "./SentimentDonut";
import { SentimentBreakdown } from "../../data/sentiment";

export interface ChartsSectionProps {
    trend: TrendPoint[];
    trendLoading: boolean;
    statusBreakdown: StatusBreakdownItem[];
    statusLoading: boolean;
    hourly: TrendPoint[];
    hourlyLoading: boolean;
    sentimentData: SentimentBreakdown | null;
    sentimentLoading: boolean;
}

// Presence color map — keys normalised to lowercase to match confirmed FormattedValue labels.

export const ChartsSection: React.FC<ChartsSectionProps> = (props) => {

    return (
        <>
            <div className="ad-section-head"><h2>Trends</h2></div>

            <div className="ad-charts-row">
                <div className="ad-panel ad-chart-panel">
                    <div className="ad-panel-head">
                        <h3>Conversations Over Time</h3>
                        <span className="ad-panel-meta">Hover to inspect</span>
                    </div>
                    <div className="ad-panel-body">
                        <TrendChart points={props.trend} isLoading={props.trendLoading} />
                    </div>
                </div>
                <div className="ad-panel ad-chart-panel">
                    <div className="ad-panel-head"><h3>Ongoing by Status</h3></div>
                    <div className="ad-panel-body">
                        <StatusBreakdownChart items={props.statusBreakdown} isLoading={props.statusLoading} />
                    </div>
                </div>
            </div>

            <div className="ad-charts-row">
                <div className="ad-panel ad-chart-panel">
                    <div className="ad-panel-head">
                        <h3>Customer Sentiment</h3>
                        <span className="ad-panel-meta">Today</span>
                    </div>
                    <div className="ad-panel-body">
                        <SentimentDonut data={props.sentimentData} isLoading={props.sentimentLoading} />
                    </div>
                </div>
                <div className="ad-panel ad-chart-panel">
                    <div className="ad-panel-head">
                        <h3>Incoming vs Engaged</h3>
                        <span className="ad-panel-meta">By hour</span>
                    </div>
                    <div className="ad-panel-body">
                        <HourlyBarChart points={props.hourly} isLoading={props.hourlyLoading} />
                    </div>
                </div>
            </div>
        </>
    );
};
