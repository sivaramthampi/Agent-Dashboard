import * as React from "react";
import { TrendPoint } from "../../data/trend";
import { HourlyBarChart } from "./HourlyBarChart";
import { SentimentDonut } from "./SentimentDonut";
import { SentimentBreakdown } from "../../data/sentiment";

export interface ChartsSectionProps {
    hourly: TrendPoint[];
    hourlyLoading: boolean;
    sentimentData: SentimentBreakdown | null;
    sentimentLoading: boolean;
}

export const ChartsSection: React.FC<ChartsSectionProps> = (props) => {

    return (
        <>
            <div className="ad-section-head"><h2>Trends</h2></div>

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
