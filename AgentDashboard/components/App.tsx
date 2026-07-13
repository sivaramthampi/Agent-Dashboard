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
import { TrendChart } from "./charts/TrendChart";
import { fetchKpis, KpiValues } from "../data/kpis";
import { fetchOngoingConversations } from "../data/conversations";
import { fetchAgentSnapshot, fetchAgentOptions, deriveAgentRows, deriveAgentsLoggedInCount, derivePresenceBreakdown, PresenceBreakdownItem, fetchAgentWrapupMetrics, AgentWrapupRow, fetchRealAgentIds } from "../data/agents";
import { fetchAvgWaitByQueue } from "../data/queueWait";
import { fetchStatusBreakdown, StatusBreakdownItem } from "../data/statusBreakdown";
import { fetchTrend, TrendPoint } from "../data/trend";
import { fetchYesterdayHourlyVolume, HourlyVolumePoint } from "../data/yesterdayVolume";
import { YesterdayPeakChart } from "./charts/YesterdayPeakChart";
import { fetchSentimentBreakdown, SentimentBreakdown } from "../data/sentiment";
import { fetchQueueOptions, fetchUserQueueIds } from "../data/queues";
import {
    buildDateRangeFilter, buildQueueFilter, buildChannelFilter, buildAgentFilter,
    formatSeconds, formatMilliseconds, formatPercent, formatDeltaPct, formatDeltaPP, ActiveFilters,
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
    const [kpiYesterday, setKpiYesterday] = useState<KpiValues | null>(null);
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
    const [yesterdayVolume, setYesterdayVolume] = useState<HourlyVolumePoint[]>([]);
    const [yesterdayVolumeLoading, setYesterdayVolumeLoading] = useState(true);
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

    // ── Full-screen loader shown only while a FILTER CHANGE is refreshing ────
    // (not on initial mount, and not on the silent interval refresh)
    const [filterRefreshing, setFilterRefreshing] = useState(false);
    const isFirstFilterRun = useRef(true);
    const overlayShownAtRef = useRef(0);
    const MIN_OVERLAY_MS = 300; // avoids a single-frame flash on fast responses

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

    // PCF's updateView() can hand us a new `context.webAPI` object reference
    // on scroll/resize (the platform re-measures the container) even though
    // it's functionally the same API. Reading it via a ref — instead of
    // depending on it directly — stops that reference churn from retriggering
    // `refresh` and, downstream, the filter-change effect (which was causing
    // the loader to flash on scroll).
    const webAPIRef = useRef(webAPI);
    webAPIRef.current = webAPI;

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
        const { filter: yesterdayDateFilter } = buildDateRangeFilter("yesterdaySamePeriod", orgTimezoneBias);
        // Full 00:00–24:00 yesterday window — for the hourly volume/peak-hour chart,
        // NOT the same-elapsed-time filter used for the KPI "vs yesterday" deltas above.
        const { filter: yesterdayFullDayFilter } = buildDateRangeFilter("yesterday", orgTimezoneBias);
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
        // Same queue/channel/agent scope, only the date window shifts back 24h —
        // gives an apples-to-apples "vs yesterday" comparison for the KPI strip.
        const yesterdayFilters: ActiveFilters = { dateFilter: yesterdayDateFilter, queueFilter, channelFilter, agentFilter, channelKeys: channelSel };
        const yesterdayFullDayFilters: ActiveFilters = { dateFilter: yesterdayFullDayFilter, queueFilter, channelFilter, agentFilter, channelKeys: channelSel };
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

        const [kpiR, kpiYesterdayR, convR, snapR, waitR, statusR, trendR, sentimentR, wrapupR, yesterdayVolR] = await Promise.allSettled([
            fetchKpis(webAPIRef.current, activeFilters),
            fetchKpis(webAPIRef.current, yesterdayFilters),
            fetchOngoingConversations(webAPIRef.current, activeFilters),
            fetchAgentSnapshot(webAPIRef.current),
            fetchAvgWaitByQueue(webAPIRef.current, activeFilters),
            fetchStatusBreakdown(webAPIRef.current, activeFilters),
            fetchTrend(webAPIRef.current, activeFilters, "hour"),
            fetchSentimentBreakdown(webAPIRef.current, activeFilters),
            fetchAgentWrapupMetrics(webAPIRef.current, activeFilters, realAgentIds),
            fetchYesterdayHourlyVolume(webAPIRef.current, yesterdayFullDayFilters, orgTimezoneBias),
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

        // Non-critical: on failure, silently keep last known comparison rather than
        // blanking the delta sub-text or surfacing a second error banner for this.
        if (kpiYesterdayR.status === "fulfilled") setKpiYesterday(kpiYesterdayR.value);
        else console.error("AgentDashboard: yesterday KPI comparison failed", kpiYesterdayR.reason);

        if (snapR.status === "fulfilled") {
            const s = snapR.value;
            // Only derive when realAgentIds is populated — prevents bots showing on first render
            if (realAgentIds.size > 0) {
                setAgents(deriveAgentRows(s, realAgentIds, agentSel));
                setAgentsLoggedInCount(deriveAgentsLoggedInCount(s, realAgentIds, agentSel));
                setPresenceBreakdown(derivePresenceBreakdown(s, realAgentIds, agentSel));
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

        if (yesterdayVolR.status === "fulfilled") setYesterdayVolume(yesterdayVolR.value);
        else console.error("AgentDashboard: yesterday hourly volume failed", yesterdayVolR.reason);
        setYesterdayVolumeLoading(false);

        setLastUpdated(new Date().toLocaleTimeString());
    }, [realAgentIds]);

    // ── Run refresh on mount + on filter changes + on interval ───────────────
    // Separate effect that re-runs when filters change so a manual filter change
    // triggers an immediate refresh, while the interval stays stable.
    useEffect(() => {
        if (!optionsReady) return; // wait for queue/agent options before first refresh

        if (isFirstFilterRun.current) {
            // Initial load after options resolve — not a user filter change, no overlay.
            isFirstFilterRun.current = false;
            void refresh();
            return;
        }

        setFilterRefreshing(true);
        overlayShownAtRef.current = Date.now();
        void refresh().finally(() => {
            // Hold the overlay for a minimum duration so fast responses
            // don't just blink on/off within a single frame.
            const elapsed = Date.now() - overlayShownAtRef.current;
            const remaining = Math.max(0, MIN_OVERLAY_MS - elapsed);
            window.setTimeout(() => setFilterRefreshing(false), remaining);
        });
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
        if (def.key === "handleTime") {
            const currentHandle = handleTimeMode === "session" ? kpi?.avgHandleTimeSessionSec : kpi?.avgHandleTimeConversationSec;
            const yesterdayHandle = handleTimeMode === "session" ? kpiYesterday?.avgHandleTimeSessionSec : kpiYesterday?.avgHandleTimeConversationSec;
            return {
                ...def,
                displayValue: values.handleTime,
                sub: formatDeltaPct(currentHandle, yesterdayHandle),
                toggle: {
                    activeKey: handleTimeMode,
                    options: [{ key:"conversation",label:"Conversation"},{ key:"session",label:"Session"}],
                },
            };
        }
        if (def.key === "total") return { ...def, displayValue: values.total, sub: formatDeltaPct(kpi?.total, kpiYesterday?.total) };
        if (def.key === "incoming") return { ...def, displayValue: values.incoming, sub: formatDeltaPct(kpi?.incoming, kpiYesterday?.incoming) };
        if (def.key === "outgoing") return { ...def, displayValue: values.outgoing, sub: formatDeltaPct(kpi?.outgoing, kpiYesterday?.outgoing) };
        if (def.key === "engaged") return { ...def, displayValue: values.engaged, sub: formatDeltaPct(kpi?.engaged, kpiYesterday?.engaged) };
        if (def.key === "queue") return { ...def, displayValue: values.queue, sub: formatDeltaPct(kpi?.inQueue, kpiYesterday?.inQueue) };
        if (def.key === "abandoned") return { ...def, displayValue: values.abandoned, sub: formatDeltaPP(kpi?.abandonedRatePct, kpiYesterday?.abandonedRatePct) };
        if (def.key === "speedToAnswer") return { ...def, displayValue: values.speedToAnswer, sub: formatDeltaPct(kpi?.avgSpeedToAnswerMs, kpiYesterday?.avgSpeedToAnswerMs) };
        if (def.key === "longestWait") return { ...def, displayValue: values.longestWait, sub: formatDeltaPct(kpi?.longestWaitSec, kpiYesterday?.longestWaitSec) };
        if (def.key === "transferRate") return { ...def, displayValue: values.transferRate, sub: formatDeltaPP(kpi?.transferRatePct, kpiYesterday?.transferRatePct) };
        return { ...def, displayValue: values[def.key] ?? null };
    });

    const errorKeys = kpiError
        ? new Set(TILE_DEFS.map(t => t.key).filter(k => k !== "agentsLoggedIn"))
        : new Set<string>();

    return (
        <div className="ad-dashboard">
            <div className={`ad-loader-overlay${filterRefreshing ? " is-visible" : ""}`} role="status" aria-live="polite">
                <div className="ad-loader-spinner" />
                <div className="ad-loader-text">Updating dashboard…</div>
            </div>
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
                statusBreakdown={statusBreakdown} statusLoading={statusLoading}
            />
            <AgentWrapupTable rows={wrapupRows} isLoading={wrapupLoading} />
            <div className="ad-two-col-panels">
                <AvgWaitByQueueTable rows={queueWaits} isLoading={queueWaitsLoading} />
                <div className="ad-panel ad-chart-panel">
                    <div className="ad-panel-head">
                        <h3>Conversations Over Time</h3>
                        <span className="ad-panel-meta">Hover to inspect</span>
                    </div>
                    <div className="ad-panel-body">
                        <TrendChart points={trend} isLoading={trendLoading} />
                    </div>
                </div>
            </div>
            <ChartsSection
                hourly={hourly} hourlyLoading={hourlyLoading}
                sentimentData={sentimentData} sentimentLoading={sentimentLoading}
            />
            <div className="ad-panel ad-chart-panel">
                <div className="ad-panel-head">
                    <h3>Yesterday's Conversation Insight</h3>
                    <span className="ad-panel-meta">By hour</span>
                </div>
                <div className="ad-panel-body">
                    <YesterdayPeakChart points={yesterdayVolume} isLoading={yesterdayVolumeLoading} />
                </div>
            </div>
        </div>
    );
};
