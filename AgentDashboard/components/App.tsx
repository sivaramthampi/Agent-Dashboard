import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { KpiTileData, ConversationRow, AgentRow, QueueWaitRow, FilterDef } from "../types";
import { KpiStrip } from "./KpiStrip";
import { FilterBar } from "./filters/FilterBar";
import { TablesSection } from "./tables/TablesSection";
import { ChartsSection } from "./charts/ChartsSection";
import { AlertBanner } from "./AlertBanner";
import { AgentWrapupTable } from "./tables/AgentWrapupTable";
import { AvgWaitByQueueTable } from "./tables/AvgWaitByQueueTable";
import { fetchKpis, KpiValues } from "../data/kpis";
import { fetchOngoingConversations } from "../data/conversations";
import { fetchAgentSnapshot, fetchAgentOptions, deriveAgentRows, deriveAgentsLoggedInCount, derivePresenceBreakdown, PresenceBreakdownItem, fetchAgentWrapupMetrics, AgentWrapupRow, fetchRealAgentIds } from "../data/agents";
import { fetchAvgWaitByQueue } from "../data/queueWait";
import { fetchStatusBreakdown, StatusBreakdownItem } from "../data/statusBreakdown";
import { fetchTrend, TrendPoint } from "../data/trend";
import { fetchSentimentBreakdown, SentimentBreakdown } from "../data/sentiment";
import { fetchQueueOptions, fetchUserQueueIds } from "../data/queues";
import {
    buildDateRangeFilter, buildQueueFilter, buildChannelFilter, buildAgentFilter,
    formatSeconds, formatMilliseconds, formatPercent, ActiveFilters,
} from "../data/dataverseUtils";

export interface AppProps {
    webAPI: ComponentFramework.WebApi;
    refreshIntervalSeconds: number;
    userId: string;
}

const TILE_DEFS: Omit<KpiTileData, "displayValue">[] = [
    { key: "total",         label: "Total Conversations",    icon: "💬", cssClass: "total",    row: 1 },
    { key: "incoming",      label: "Incoming", icon: "📥", cssClass: "incoming", row: 1 },
    { key: "outgoing",      label: "Outgoing", icon: "📤", cssClass: "outgoing", row: 1 },
    { key: "engaged",       label: "Engaged",                icon: "🤝", cssClass: "engaged",  row: 1 },
    { key: "queue",         label: "In Queue",               icon: "⏳", cssClass: "queue",    row: 1 },
    { key: "abandoned",     label: "Abandoned Rate",         icon: "⚠️", cssClass: "abandoned", row: 1 },
    { key: "speedToAnswer", label: "Avg. Speed to Answer",   icon: "⚡", cssClass: "speed",    row: 2 },
    { key: "handleTime",    label: "Avg. Handle Time",       icon: "⏱️", cssClass: "handle",  row: 2 },
    { key: "longestWait",   label: "Longest Wait Time",      icon: "🕑", cssClass: "wait",    row: 2 },
    { key: "agentsLoggedIn",label: "Agents Logged In",       icon: "👤", cssClass: "agents",  row: 2 },
    { key: "transferRate",  label: "Transfer Rate",          icon: "⇄",  cssClass: "transfer", row: 2 },
    { key: "sentiment",     label: "Customer Sentiment",     icon: "😊", cssClass: "sentiment", row: 2 },
];

function buildInitialFilters(): FilterDef[] {
    return [
        { key: "queue",   label: "Queue",   mode: "multi",  options: [], selectedKeys: new Set() },
        { key: "channel", label: "Channel", mode: "multi",
          options: [{ key:"voice",label:"Voice"},{ key:"sms",label:"SMS"},{ key:"chat",label:"Chat"},{ key:"email",label:"Email"}],
          selectedKeys: new Set(["voice","sms","chat","email"]) },
        { key: "agent",   label: "Agent",   mode: "multi",  options: [], selectedKeys: new Set() },
    ];
}

function buildTileValues(kpi: KpiValues | null, handleTimeMode: string): Record<string, string | null> {
    if (!kpi) return Object.fromEntries(TILE_DEFS.map(t => [t.key, null]));
    return {
        total:         kpi.total.toString(),
        incoming:      kpi.incoming.toString(),
        outgoing:      kpi.outgoing.toString(),
        engaged:       kpi.engaged.toString(),
        queue:         kpi.inQueue.toString(),
        abandoned:     formatPercent(kpi.abandonedRatePct),
        speedToAnswer: formatMilliseconds(kpi.avgSpeedToAnswerMs),
        handleTime:    formatSeconds(handleTimeMode === "session" ? kpi.avgHandleTimeSessionSec : kpi.avgHandleTimeConversationSec),
        longestWait:   formatSeconds(kpi.longestWaitSec),
        agentsLoggedIn: null,
        transferRate:  formatPercent(kpi.transferRatePct),
    };
}

// Stable serialisation of a Set<string> → string for use as useEffect/useCallback dep.
// This avoids new Set() objects causing infinite re-render loops.
function serializeSet(s: Set<string>): string {
    return Array.from(s).sort().join(",");
}

export const App: React.FC<AppProps> = ({ webAPI, refreshIntervalSeconds, userId }) => {
    const [filters, setFilters] = useState<FilterDef[]>(buildInitialFilters);
    const [handleTimeMode, setHandleTimeMode] = useState("conversation");

    const [kpi, setKpi] = useState<KpiValues | null>(null);
    const [kpiError, setKpiError] = useState(false);
    const [kpiRefreshing, setKpiRefreshing] = useState(false);
    const [agentsLoggedInCount, setAgentsLoggedInCount] = useState<number | null>(null);

    const [conversations, setConversations] = useState<ConversationRow[]>([]);
    const [conversationsLoading, setConversationsLoading] = useState(true);
    const [conversationsError, setConversationsError] = useState(false);
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

    const [agents, setAgents] = useState<AgentRow[]>([]);
    const [agentsLoading, setAgentsLoading] = useState(true);
    const [queueWaits, setQueueWaits] = useState<QueueWaitRow[]>([]);
    const [queueWaitsLoading, setQueueWaitsLoading] = useState(true);
    const [trend, setTrend] = useState<TrendPoint[]>([]);
    const [trendLoading, setTrendLoading] = useState(true);
    const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdownItem[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);
    const [presenceBreakdown, setPresenceBreakdown] = useState<PresenceBreakdownItem[]>([]);
    const [hourly, setHourly] = useState<TrendPoint[]>([]);
    const [hourlyLoading, setHourlyLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState("Initializing…");
    const [sentimentData, setSentimentData] = useState<SentimentBreakdown | null>(null);
    const [sentimentLoading, setSentimentLoading] = useState(true);
    const [wrapupRows, setWrapupRows] = useState<AgentWrapupRow[]>([]);
    const [wrapupLoading, setWrapupLoading] = useState(true);
    // Default to 420 (Arizona/US Mountain no-DST = UTC-7).
    // Matches PBIX which uses #duration(0,-7,0,0). Canyon Ranch is in Tucson AZ (no DST).
    // loadOptions will confirm from usersettings.timezonebias.
    const [orgTimezoneBias, setOrgTimezoneBias] = useState<number>(420);
    const [optionsReady, setOptionsReady] = useState(false);
    const [realAgentIds, setRealAgentIds] = useState<Set<string>>(new Set());

    // ── Stable filter value refs — avoids Set object identity churn ──────────
    const getFilter = (key: string) => filters.find(f => f.key === key);

    const timeKey        = "today"; // time filter removed — always today
    const queueSelKeys   = serializeSet(getFilter("queue")?.selectedKeys   ?? new Set());
    const queueAllKeys   = serializeSet(new Set((getFilter("queue")?.options ?? []).map(o => o.key)));
    const channelSelKeys = serializeSet(getFilter("channel")?.selectedKeys ?? new Set());
    const agentSelKeys   = serializeSet(getFilter("agent")?.selectedKeys   ?? new Set());

    // Keep a ref to actual filter state for use inside the refresh callback
    // without making it a dependency (prevents interval recreation on every filter change)
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    // ── Load queue + agent options once on mount ──────────────────────────────
    // Uses a ref guard so it never runs twice even in StrictMode
    const optionsLoaded = useRef(false);
    useEffect(() => {
        if (optionsLoaded.current) return;
        optionsLoaded.current = true;
        async function loadOptions() {
            try {
                // Fetch timezone from user's D365 personal setting (usersettings.timezonebias).
                // All Canyon Ranch staff are configured to US Central (UTC-6, bias=360)
                // which matches the Power BI report timezone.
                // Falls back to browser timezone if the fetch fails.
                const [queueOptions, agentOptions, realAgentIdSet, userQueueIds, tzResult] = await Promise.all([
                    fetchQueueOptions(webAPI),
                    fetchAgentOptions(webAPI),
                    fetchRealAgentIds(webAPI),
                    fetchUserQueueIds(webAPI, userId),
                    // userId from PCF context may be empty — skip tz fetch rather than failing Promise.all
                    (userId
                        ? webAPI.retrieveRecord("usersettings", userId, "?$select=timezonecode,timezonebias").catch(() => null)
                        : Promise.resolve(null)
                    ),
                ]);
                // Set queue/agent options FIRST — before any further async calls
                // so a tz lookup failure never blocks the filter dropdown
                setRealAgentIds(realAgentIdSet);
                setFilters(prev => prev.map(f => {
                    if (f.key === "queue") return {
                        ...f,
                        options: queueOptions,
                        // Preselect only the queues the logged-in user is a member of.
                        // If membership fetch returned nothing, fall back to all queues.
                        selectedKeys: (() => {
                            const preselected = userQueueIds.size > 0
                                ? new Set(queueOptions.map(o => o.key).filter(k => userQueueIds.has(k)))
                                : new Set(queueOptions.map(o => o.key));
                            console.log(
                                "%c[AD Queue Preselect]",
                                "background:#8B5CF6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
                                `userQueueIds: ${userQueueIds.size}, preselected: ${preselected.size}`,
                                [...preselected].slice(0,3)
                            );
                            return preselected;
                        })(),
                    };
                    if (f.key === "agent") return { ...f, options: agentOptions };
                    return f;
                }));
                // Update timezone bias from usersettings — non-blocking
                if (tzResult != null && tzResult["timezonebias"] !== undefined) {
                    const bias = tzResult["timezonebias"] as number;
                    setOrgTimezoneBias(bias);
                    console.log(
                        "%c[AgentDashboard] Timezone bias: " + bias + " min (UTC-" + Math.abs(bias / 60) + ")",
                        "background:#7C3AED;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600"
                    );
                }
                setOptionsReady(true);
            } catch (err) {
                console.error("AgentDashboard: failed to load filter options", err);
                // Still mark options ready so refresh can fire with default filters
                setOptionsReady(true);
            }
        }
        void loadOptions();
    }, [webAPI]);

    // ── Main refresh — stable callback, reads current filter values from ref ──
    const refresh = useCallback(async () => {
        const currentFilters = filtersRef.current;
        const getF = (key: string) => currentFilters.find(f => f.key === key);

        const timeK     = "today"; // no time filter UI — always today
        const queueSel  = getF("queue")?.selectedKeys   ?? new Set<string>();
        const queueAll  = new Set((getF("queue")?.options ?? []).map(o => o.key));
        const channelSel= getF("channel")?.selectedKeys ?? new Set<string>();
        const agentSel  = getF("agent")?.selectedKeys   ?? new Set<string>();

        const { filter: dateFilter } = buildDateRangeFilter(timeK, orgTimezoneBias);
        const queueFilter   = buildQueueFilter(queueSel, queueAll);
        console.log(
            "%c[AD Queue Filter]",
            "background:#D97706;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
            "selected:", queueSel.size, "/ all:", queueAll.size,
            "| filter:", queueFilter || "(none — all queues selected)"
        );
        const channelFilter = buildChannelFilter(channelSel);
        const agentFilter   = buildAgentFilter(agentSel);

        const activeFilters: ActiveFilters = { dateFilter, queueFilter, channelFilter, agentFilter, channelKeys: channelSel };
        // Hourly chart uses same date scope as all other queries

        console.log(
            '%c[AgentDashboard] Active filters',
            'background:#059669;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
            '\n  dateFilter   :', dateFilter || '(none)',
            '\n  queueFilter  :', queueFilter || '(none — all queues)',
            '\n  channelFilter:', channelFilter || '(none — all channels)',
            '\n  agentFilter  :', agentFilter || '(none — all agents)',
            '\n  Full KPI filter:', [dateFilter, queueFilter, channelFilter, agentFilter].filter(Boolean).join(' and ') || '(no filter)'
        );

        const [kpiR, convR, snapR, waitR, statusR, trendR, sentimentR, wrapupR] = await Promise.allSettled([
            fetchKpis(webAPI, activeFilters),
            fetchOngoingConversations(webAPI, activeFilters),
            fetchAgentSnapshot(webAPI),
            fetchAvgWaitByQueue(webAPI, activeFilters),
            fetchStatusBreakdown(webAPI, activeFilters),
            fetchTrend(webAPI, activeFilters, "hour"),
            fetchSentimentBreakdown(webAPI, dateFilter),
            fetchAgentWrapupMetrics(webAPI, activeFilters, realAgentIds),
        ]);


        setKpiRefreshing(false);
        if (kpiR.status === "fulfilled") {
            setKpi(kpiR.value);
            setKpiError(false);
            console.log(
                "%c[AD Counts]",
                "background:#6366F1;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
                "Total:", kpiR.value.total,
                "| Incoming:", kpiR.value.incoming,
                "| Outgoing:", kpiR.value.outgoing,
                "| Engaged:", kpiR.value.engaged,
                "| InQueue:", kpiR.value.inQueue,
                "| Abandoned%:", kpiR.value.abandonedRatePct.toFixed(1),
                "| Transfer%:", kpiR.value.transferRatePct.toFixed(1)
            );
        } else { console.error("AgentDashboard: KPI failed", kpiR.reason); setKpiError(true); }

        if (snapR.status === "fulfilled") {
            const s = snapR.value;
            // Only derive when realAgentIds is populated — prevents bots showing on first render
            if (realAgentIds.size > 0) {
                setAgents(deriveAgentRows(s, realAgentIds));
                setAgentsLoggedInCount(deriveAgentsLoggedInCount(s, realAgentIds));
                setPresenceBreakdown(derivePresenceBreakdown(s, realAgentIds));
            }
            // Populate agent filter options from snapshot on first load
            // Use all agents (logged in or not) so supervisor can filter by any agent
            setFilters(prev => {
                const agentFilter = prev.find(f => f.key === "agent");
                // Only update if options are empty (first load) to avoid resetting user selection
                if (!agentFilter || agentFilter.options.length > 0) return prev;
                const opts = s.map(a => ({ key: a.agentId, label: a.name }))
                    .filter(o => o.key && o.label && !o.label.toLowerCase().includes("bot"))
                    .sort((a, b) => a.label.localeCompare(b.label));
                return prev.map(f => f.key === "agent" ? { ...f, options: opts } : f);
            });
        } else console.error("AgentDashboard: agent snapshot failed", snapR.reason);
        setAgentsLoading(false);

        if (convR.status === "fulfilled")  { setConversations(convR.value); setConversationsError(false); }
        else                               { console.error("AgentDashboard: conversations failed", convR.reason); setConversationsError(true); }
        setConversationsLoading(false);

        if (waitR.status === "fulfilled")  setQueueWaits(waitR.value);
        else                               console.error("AgentDashboard: queue wait failed", waitR.reason);
        setQueueWaitsLoading(false);

        if (statusR.status === "fulfilled") setStatusBreakdown(statusR.value);
        else                                console.error("AgentDashboard: status breakdown failed", statusR.reason);
        setStatusLoading(false);

        if (trendR.status === "fulfilled") { setTrend(trendR.value); setHourly(trendR.value); }
        else { console.error("AgentDashboard: trend failed", trendR.reason); }
        setTrendLoading(false);
        setHourlyLoading(false);

        if (sentimentR.status === "fulfilled") setSentimentData(sentimentR.value);
        else console.error("AgentDashboard: sentiment failed", sentimentR.reason);
        setSentimentLoading(false);

        if (wrapupR.status === "fulfilled") setWrapupRows(wrapupR.value);
        else console.error("AgentDashboard: wrapup failed", wrapupR.reason);
        setWrapupLoading(false);

        setLastUpdated(new Date().toLocaleTimeString());
    }, [webAPI, realAgentIds]);

    // ── Run refresh on mount + on filter changes + on interval ───────────────
    // Separate effect that re-runs when filters change so a manual filter change
    // triggers an immediate refresh, while the interval stays stable.
    useEffect(() => {
        if (!optionsReady) return; // wait for queue/agent options before first refresh
        void refresh();
    // These serialised strings are stable primitives — safe as deps.
    }, [refresh, queueSelKeys, queueAllKeys, channelSelKeys, agentSelKeys, orgTimezoneBias, optionsReady]);

    useEffect(() => {
        const intervalMs = Math.max(15, refreshIntervalSeconds) * 1000;
        const handle = window.setInterval(() => void refresh(), intervalMs);
        return () => window.clearInterval(handle);
    }, [refresh, refreshIntervalSeconds]);

    function handleFilterChange(key: string, selectedKeys: Set<string>) {
        setFilters(prev => prev.map(f => f.key === key ? { ...f, selectedKeys } : f));
    }

    function handleToggle(tileKey: string, optionKey: string) {
        if (tileKey === "handleTime") setHandleTimeMode(optionKey);
    }

    const values = buildTileValues(kpi, handleTimeMode);
    const tiles: KpiTileData[] = TILE_DEFS.map(def => {
        if (def.key === "agentsLoggedIn") return {
            ...def,
            displayValue: agentsLoggedInCount === null ? null : agentsLoggedInCount.toString(),
        };
        if (def.key === "sentiment") {
            if (!sentimentData || sentimentData.total === 0) return { ...def, displayValue: null };
            // Weighted avg mapped to % — (avgScore + 3) / 6 × 100
            // Maps -3 (very negative) → 0%, 0 (neutral) → 50%, +3 (very positive) → 100%
            const netPct = Math.round(((sentimentData.averageScore + 3) / 6) * 100);
            // Dynamic icon based on overall sentiment group
            const og = sentimentData.overallGroup;
            const icon = (og === "very_positive" || og === "positive") ? "😊"
                : og === "slightly_positive" ? "🙂"
                : og === "slightly_negative" ? "😕"
                : (og === "negative" || og === "very_negative") ? "😟"
                : "😐";
            return {
                ...def,
                icon,
                displayValue: `${netPct}%`,
                sub: `${sentimentData.averageScore >= 0 ? "+" : ""}${sentimentData.averageScore.toFixed(2)} avg score`,
            };
        }
        if (def.key === "handleTime") return {
            ...def,
            displayValue: values.handleTime,
            toggle: {
                activeKey: handleTimeMode,
                options: [{ key:"conversation",label:"Conversation"},{ key:"session",label:"Session"}],
            },
        };
        return { ...def, displayValue: values[def.key] ?? null };
    });

    const errorKeys = kpiError
        ? new Set(TILE_DEFS.map(t => t.key).filter(k => k !== "agentsLoggedIn"))
        : new Set<string>();

    return (
        <div className="ad-dashboard">
            <div className="ad-header">
                <div className="ad-title"><span className="ad-live-dot" />Agent Dashboard</div>
                <div className="ad-last-updated">Last updated: {lastUpdated}</div>
            </div>
            <FilterBar filters={filters} onFilterChange={handleFilterChange} />
            <AlertBanner kpi={kpi} conversations={conversations} />
            <KpiStrip tiles={tiles} errorKeys={errorKeys} onToggle={handleToggle} kpi={kpi} isRefreshing={kpiRefreshing} />
            <div className="ad-section-head"><h2>Live Activity</h2></div>
            <TablesSection
                conversations={conversations} conversationsLoading={conversationsLoading}
                conversationsError={conversationsError}
                selectedRowId={selectedRowId} onSelectRow={setSelectedRowId}
                agents={agents} agentsLoading={agentsLoading}
                presenceBreakdown={presenceBreakdown}
            />
            <div className="ad-two-col-panels">
                <AvgWaitByQueueTable rows={queueWaits} isLoading={queueWaitsLoading} />
                <AgentWrapupTable rows={wrapupRows} isLoading={wrapupLoading} />
            </div>
            <ChartsSection
                trend={trend} trendLoading={trendLoading}
                statusBreakdown={statusBreakdown} statusLoading={statusLoading}
                hourly={hourly} hourlyLoading={hourlyLoading}
                sentimentData={sentimentData} sentimentLoading={sentimentLoading}
            />
        </div>
    );
};
