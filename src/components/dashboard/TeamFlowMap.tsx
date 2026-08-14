import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Maximize2,
  Minimize2,
  Radar,
  CheckCircle2,
  Activity,
  Search,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  Clock,
  User,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  CheckCheck,
  Flame,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { SectionCard, EmptyPanel } from "@/components/dashboard/dashboard-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { fetchBugs, fetchProfiles, fetchUserRoleMap, type Bug } from "@/lib/api";
import {
  buildFlowGraph,
  relatedIds,
  type FlowNode,
  type FlowRecentResolvedBug,
} from "@/lib/team-flow";
import { DashboardPagination } from "@/components/dashboard/DashboardPagination";

const COPY = {
  en: {
    title: "Team Flow Map & Live Resolution Feed",
    kicker: "testers ⇄ developers · dynamic motion routing & live resolution",
    testers: "Testers",
    developers: "Developers",
    empty: "No routed errors yet",
    emptyDetail:
      "Once errors are reported and assigned, the dynamic flow and real-time resolution between testers and developers will appear here.",
    reset: "Reset View",
    focus: "Focused",
    errors: "errors",
    open: "open",
    resolved: "resolved",
    inProgress: "in progress",
    unassigned: "unassigned",
    links: "routes",
    hint: "hover a node or resolved card to trace routes · click to inspect resolution details",
    related: "Member Resolution & Workload",
    viewAll: "Open in error list",
    unknownMember: "Deleted User",
    idLabel: "account id",
    critical: "critical",
    roleLabel: "role",
    expand: "Fullscreen",
    collapse: "Exit fullscreen",
    live: "Live Sync",
    liveTicker: "Live Resolved Stream",
    liveTickerEmpty: "No recently resolved bugs yet.",
    resolutionRate: "Resolution Rate",
    allRoutes: "All Flows",
    resolvedFilter: "Resolved Bugs",
    activeFilter: "Active / In Progress",
    criticalFilter: "Critical",
    searchMember: "Find developer / tester...",
    tabResolved: "Resolved",
    tabOpen: "Open & Active",
    tabAll: "All Errors",
    searchBugs: "Filter member errors...",
    searchStream: "Filter resolved stream...",
    lastSync: "Live connected",
    resolvedFlowTag: "Resolved ➔ For Verification",
    testerTag: "Reporter / Tester",
    devTag: "Resolved By",
  },
  ar: {
    title: "خريطة تفاعل الفريق وتدفق الحلول اللحظي",
    kicker: "المختبرون ⇄ المطورون · تباين حركي وتحديثات الحلول لحظة بلحظة",
    testers: "المختبرون",
    developers: "المطورون",
    empty: "لا توجد أخطاء موجّهة بعد",
    emptyDetail:
      "بعد تسجيل الأخطاء وإسنادها سيظهر هنا مسار العمل والتباين الحركي ومعدل الإنجاز بين المختبرين والمطورين.",
    reset: "إعادة الضبط",
    focus: "محدد",
    errors: "أخطاء",
    open: "مفتوحة",
    resolved: "تم حلها",
    inProgress: "قيد العمل",
    unassigned: "غير مُسندة",
    links: "مسارات",
    hint: "مرّر على أي عضو أو كارت حل لتتبع مساراته · اضغط لفحص تفاصيل المطور وتدفقاته",
    related: "الأخطاء وإنجاز العضو",
    viewAll: "افتح في قائمة الأخطاء",
    unknownMember: "مستخدم محذوف",
    idLabel: "معرّف الحساب",
    critical: "حرجة",
    roleLabel: "الدور",
    expand: "ملء الشاشة",
    collapse: "إنهاء ملء الشاشة",
    live: "بث مباشر لحظي",
    liveTicker: "شريط الأخطاء المحلولة لحظة بلحظة",
    liveTickerEmpty: "لا توجد أخطاء تم حلها مؤخراً.",
    resolutionRate: "نسبة الإنجاز",
    allRoutes: "كل المسارات",
    resolvedFilter: "الأخطاء المحلولة",
    activeFilter: "قيد العمل والمفتوحة",
    criticalFilter: "الحرجة فقط",
    searchMember: "بحث عن مطور أو مختبر...",
    tabResolved: "المحلولة",
    tabOpen: "المفتوحة وقيد العمل",
    tabAll: "الكل",
    searchBugs: "تصفية أخطاء العضو...",
    searchStream: "تصفية الأخطاء المحلولة...",
    lastSync: "متصل لحظياً",
    resolvedFlowTag: "تم الحل ➔ للمختبر للتحقق",
    testerTag: "المختبر",
    devTag: "حل بواسطة",
  },
} as const;

// Proportional SVG geometry calibrated to prevent any label clipping inside container
const WIDTH = 1060;
const HEIGHT = 500;
const LEFT_X = 260; // 250px safe text zone on left
const RIGHT_X = 800; // 250px safe text zone on right

const RESOLVED_STATUSES = new Set(["Fixed", "Closed", "Resolved"]);
const LIVE_STREAM_PAGE_SIZE = 6;

function laneY(index: number, count: number) {
  if (count <= 1) return HEIGHT / 2;
  const top = 75;
  const bottom = HEIGHT - 65;
  return top + (index * (bottom - top)) / (count - 1);
}

function radiusFor(node: FlowNode, max: number) {
  const scale = max > 0 ? node.total / max : 0;
  return 11 + scale * 12;
}

/** Strictly bounds name length so it stays 100% inside SVG margin */
function shortLabel(value: string, max = 18) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function TeamFlowMap() {
  const { language } = useI18n();
  const isRtl = language === "ar";
  const copy = COPY[isRtl ? "ar" : "en"];
  const queryClient = useQueryClient();

  const [focus, setFocusState] = useState<string | null>(null);
  const [focusedTab, setFocusedTab] = useState<"resolved" | "open" | "all">("resolved");
  const [focusedPage, setFocusedPage] = useState(1);
  const [focusedSearch, setFocusedSearch] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [hoveredStreamBug, setHoveredStreamBug] = useState<FlowRecentResolvedBug | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "resolved" | "active" | "critical">("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [showLiveTicker, setShowLiveTicker] = useState(true);
  const [liveStreamPage, setLiveStreamPage] = useState(1);
  const [liveStreamSearch, setLiveStreamSearch] = useState("");

  // Queries
  const bugsQuery = useQuery({ queryKey: ["flow-bugs"], queryFn: fetchBugs, staleTime: 10_000 });
  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 60_000,
  });
  const rolesQuery = useQuery({
    queryKey: ["user-role-map"],
    queryFn: fetchUserRoleMap,
    staleTime: 60_000,
  });

  // Real-time Supabase subscription on bugs table for moment-by-moment updates
  useEffect(() => {
    const channel = supabase
      .channel("team-flow-bugs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bugs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["flow-bugs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const bugs = bugsQuery.data ?? [];
  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profilesQuery.data ?? []) map[p.id] = p.username ?? p.id.slice(0, 8);
    return map;
  }, [profilesQuery.data]);

  const graph = useMemo(
    () => buildFlowGraph(bugs, names, rolesQuery.data ?? {}),
    [bugs, names, rolesQuery.data]
  );

  const active = hover ?? focus;
  const highlighted = useMemo(() => relatedIds(graph, active), [graph, active]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; node: FlowNode }>();
    graph.testers.forEach((node, index) =>
      map.set(node.id, { x: LEFT_X, y: laneY(index, graph.testers.length), node })
    );
    graph.developers.forEach((node, index) =>
      map.set(node.id, { x: RIGHT_X, y: laneY(index, graph.developers.length), node })
    );
    return map;
  }, [graph]);

  const maxTotal = Math.max(1, ...[...positions.values()].map((p) => p.node.total));
  const isLoading = bugsQuery.isLoading || profilesQuery.isLoading || rolesQuery.isLoading;

  const setFocus = (val: string | null | ((prev: string | null) => string | null)) => {
    setFocusedPage(1);
    setFocusedSearch("");
    setFocusState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      if (next) {
        const node = positions.get(next)?.node;
        if (node && node.resolved > 0) {
          setFocusedTab("resolved");
        } else {
          setFocusedTab("all");
        }
      }
      return next;
    });
  };

  // Filtered Live Resolved Stream for clean pagination
  const filteredLiveStream = useMemo(() => {
    let list = graph.liveResolvedStream;
    if (liveStreamSearch.trim()) {
      const term = liveStreamSearch.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.bugId.toLowerCase().includes(term) ||
          item.developerName.toLowerCase().includes(term) ||
          (item.testerName && item.testerName.toLowerCase().includes(term)) ||
          (item.module && item.module.toLowerCase().includes(term))
      );
    }
    return list;
  }, [graph.liveResolvedStream, liveStreamSearch]);

  const paginatedLiveStream = useMemo(() => {
    const start = (liveStreamPage - 1) * LIVE_STREAM_PAGE_SIZE;
    return filteredLiveStream.slice(start, start + LIVE_STREAM_PAGE_SIZE);
  }, [filteredLiveStream, liveStreamPage]);

  // Focused member details
  const focusedNode = focus ? positions.get(focus)?.node : null;

  const focusedMemberBugs: Bug[] = useMemo(() => {
    if (!focus) return [];
    let list = bugs.filter((b) => b.reported_by === focus || b.assigned_to === focus);

    if (focusedTab === "resolved") {
      list = list.filter((b) => RESOLVED_STATUSES.has(b.status));
    } else if (focusedTab === "open") {
      list = list.filter((b) => !RESOLVED_STATUSES.has(b.status));
    }

    if (focusedSearch.trim()) {
      const term = focusedSearch.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          b.bug_id.toLowerCase().includes(term) ||
          (b.module && b.module.toLowerCase().includes(term))
      );
    }

    // Sort: resolved bugs sorted by updated_at desc, open by priority
    return list.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [bugs, focus, focusedTab, focusedSearch]);

  const body = (
    <>
      {isLoading ? (
        <Skeleton className="h-[480px] w-full rounded-xl" />
      ) : positions.size === 0 ? (
        <EmptyPanel title={copy.empty} detail={copy.emptyDetail} />
      ) : (
        <div className="w-full min-w-0 space-y-4 overflow-hidden">
          {/* Top Control Bar with Live Status & Mode Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Live Beacon & Summary Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1 px-2.5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {copy.live}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-primary/20 bg-muted/40 text-xs text-muted-foreground font-mono"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="font-semibold text-foreground">{graph.totalResolved}</span>{" "}
                {copy.resolved}
              </Badge>

              <Badge
                variant="outline"
                className="gap-1 border-primary/20 bg-muted/40 text-xs text-muted-foreground font-mono"
              >
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="font-semibold text-foreground">{graph.totalOpen}</span> {copy.open}
              </Badge>

              {graph.totalCritical > 0 && (
                <Badge
                  variant="outline"
                  className="gap-1 border-destructive/30 bg-destructive/10 text-xs text-destructive font-mono"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-semibold">{graph.totalCritical}</span> {copy.critical}
                </Badge>
              )}
            </div>

            {/* Mode Selector Tabs */}
            <div className="flex flex-wrap items-center gap-1 bg-muted/50 p-0.5 rounded-lg border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === "all"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {copy.allRoutes}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("resolved")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === "resolved"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {copy.resolvedFilter}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("active")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === "active"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap className="h-3 w-3 text-amber-500" />
                {copy.activeFilter}
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("critical")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
                  filterMode === "critical"
                    ? "bg-destructive/15 text-destructive shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AlertTriangle className="h-3 w-3 text-destructive" />
                {copy.criticalFilter}
              </button>
            </div>
          </div>

          {/* Search Member input & Live Ticker Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute start-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={copy.searchMember}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="h-8 ps-8 text-xs bg-background/80"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={showLiveTicker ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 text-xs text-foreground"
                onClick={() => setShowLiveTicker((prev) => !prev)}
              >
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {copy.liveTicker} ({graph.liveResolvedStream.length})
                </span>
              </Button>
            </div>
          </div>

          {/* ── Paginated Live Resolved Stream Ticker (Developer ➔ Tester Flow) ── */}
          {showLiveTicker && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-3 animate-in fade-in-50 duration-200 overflow-hidden shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {copy.liveTicker}
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px] border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-mono"
                      >
                        {filteredLiveStream.length} {copy.resolved}
                      </Badge>
                    </h4>
                    <p className="text-[10.5px] text-muted-foreground">
                      {copy.resolvedFlowTag}
                    </p>
                  </div>
                </div>

                {/* Filter input inside stream */}
                <div className="relative max-w-xs w-full sm:w-auto">
                  <Search className="absolute start-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={copy.searchStream}
                    value={liveStreamSearch}
                    onChange={(e) => {
                      setLiveStreamSearch(e.target.value);
                      setLiveStreamPage(1);
                    }}
                    className="h-7 ps-8 text-xs bg-background/90"
                  />
                </div>
              </div>

              {filteredLiveStream.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                  {copy.liveTickerEmpty}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {paginatedLiveStream.map((item) => {
                      const isItemHovered =
                        hoveredStreamBug?.id === item.id ||
                        (active === item.developerId &&
                          item.testerId &&
                          highlighted.has(item.testerId));

                      return (
                        <Link
                          key={`${item.id}-${item.resolvedAt}`}
                          to="/bugs/$id"
                          params={{ id: String(item.id) }}
                          onMouseEnter={() => setHoveredStreamBug(item)}
                          onMouseLeave={() => setHoveredStreamBug(null)}
                          className={`group flex flex-col justify-between gap-2 rounded-lg border p-2.5 text-xs transition-all shadow-xs min-w-0 ${
                            isItemHovered
                              ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/40 shadow-sm"
                              : "border-border/60 bg-background/90 hover:border-emerald-500/50 hover:bg-muted/40"
                          }`}
                        >
                          {/* Top: Bug ID & Title */}
                          <div className="flex items-start justify-between gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              <span className="font-mono text-[10.5px] font-bold text-primary shrink-0">
                                {item.bugId}
                              </span>
                              <span className="font-semibold text-foreground truncate">
                                {item.title}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground shrink-0 ps-1">
                              {formatDistanceToNow(new Date(item.resolvedAt), { addSuffix: true })}
                            </span>
                          </div>

                          {/* Dynamic Route Indicator: Developer ➔ Tester */}
                          <div className="flex items-center justify-between gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-[10.5px] border border-border/40 font-mono">
                            {/* Developer (Sender of resolution) */}
                            <div className="flex items-center gap-1 min-w-0 text-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="font-medium truncate text-emerald-600 dark:text-emerald-400">
                                {item.developerName}
                              </span>
                            </div>

                            {/* Motion Arrow */}
                            <div className="flex items-center text-emerald-500 shrink-0">
                              {isRtl ? (
                                <ArrowLeft className="h-3 w-3 animate-pulse" />
                              ) : (
                                <ArrowRight className="h-3 w-3 animate-pulse" />
                              )}
                            </div>

                            {/* Tester (Receiver for verification) */}
                            <div className="flex items-center gap-1 min-w-0 text-muted-foreground">
                              <span className="truncate">
                                {item.testerName ? item.testerName : copy.unknownMember}
                              </span>
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                            </div>
                          </div>

                          {/* Footer Module Tag */}
                          {item.module && (
                            <div className="text-[10px] text-muted-foreground flex items-center justify-between px-0.5">
                              <span className="truncate">Module: {item.module}</span>
                              <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline">
                                {copy.viewAll} ➔
                              </span>
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Clean Pagination Component */}
                  <DashboardPagination
                    page={liveStreamPage}
                    totalItems={filteredLiveStream.length}
                    pageSize={LIVE_STREAM_PAGE_SIZE}
                    onPageChange={setLiveStreamPage}
                    itemLabel="resolved bugs"
                  />
                </div>
              )}
            </div>
          )}

          {/* SVG Map Container — fully bounded with no clipping */}
          <div className="relative w-full min-w-0 overflow-hidden rounded-xl border border-border/60 bg-[oklch(0.18_0.04_255)] shadow-inner">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              className={expanded ? "block h-[70vh] w-full" : "block h-auto w-full max-h-[520px]"}
              role="img"
              aria-label={copy.title}
            >
              <defs>
                <radialGradient id="flow-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="resolved-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="tester-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
                <pattern id="flow-grid" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path
                    d="M46 0H0V46"
                    fill="none"
                    stroke="var(--chart-2)"
                    strokeOpacity="0.10"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect width={WIDTH} height={HEIGHT} fill="url(#flow-grid)" />
              <circle
                cx={WIDTH / 2}
                cy={HEIGHT / 2}
                r={240}
                fill={
                  filterMode === "resolved"
                    ? "url(#resolved-glow)"
                    : filterMode === "active"
                    ? "url(#tester-glow)"
                    : "url(#flow-glow)"
                }
              />
              <circle
                cx={WIDTH / 2}
                cy={HEIGHT / 2}
                r={190}
                fill="none"
                stroke={filterMode === "resolved" ? "#10b981" : "var(--chart-2)"}
                strokeOpacity="0.18"
                strokeDasharray="3 8"
                className="team-flow-spin"
                style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px` }}
              />

              {/* Column Header Banners */}
              <text
                x={LEFT_X}
                y={38}
                textAnchor="middle"
                className="fill-[var(--chart-3)] font-mono text-[13px] uppercase font-bold tracking-wider"
              >
                {copy.testers} ({graph.testers.length})
              </text>
              <text
                x={RIGHT_X}
                y={38}
                textAnchor="middle"
                className="fill-[var(--chart-2)] font-mono text-[13px] uppercase font-bold tracking-wider"
              >
                {copy.developers} ({graph.developers.length})
              </text>

              {/* Routing Curves Between Testers & Developers with Bidirectional Motion */}
              {graph.links.map((link) => {
                const a = positions.get(link.from);
                const b = positions.get(link.to);
                if (!a || !b) return null;

                // Mode filter visibility
                if (filterMode === "resolved" && link.resolved === 0) return null;
                if (filterMode === "active" && link.open === 0 && link.inProgress === 0)
                  return null;
                if (filterMode === "critical" && link.critical === 0) return null;

                const isStreamHovered =
                  hoveredStreamBug &&
                  hoveredStreamBug.developerId === link.to &&
                  hoveredStreamBug.testerId === link.from;

                const isDim =
                  hoveredStreamBug
                    ? !isStreamHovered
                    : active
                    ? !(highlighted.has(link.from) && highlighted.has(link.to))
                    : false;

                const midY = (a.y + b.y) / 2 + (b.y > a.y ? -42 : 42);
                // Forward Path (Tester ➔ Dev)
                const forwardPath = `M${a.x} ${a.y} Q${WIDTH / 2} ${midY} ${b.x} ${b.y}`;
                // Reverse Path (Dev ➔ Tester) for resolved bug flow!
                const reversePath = `M${b.x} ${b.y} Q${WIDTH / 2} ${midY + (b.y > a.y ? 32 : -32)} ${a.x} ${a.y}`;

                const isCriticalLink = link.critical > 0;
                const isResolvedLink = link.resolved > 0;
                const isOpenLink = link.open > 0 || link.inProgress > 0;

                const strokeColor =
                  isStreamHovered
                    ? "#10b981"
                    : filterMode === "critical" || isCriticalLink
                    ? "#f43f5e"
                    : filterMode === "resolved" || (isResolvedLink && !isOpenLink)
                    ? "#10b981"
                    : isOpenLink
                    ? "#38bdf8"
                    : "var(--chart-2)";

                const dashClass =
                  isStreamHovered || isResolvedLink
                    ? "team-flow-resolved-dash"
                    : isCriticalLink
                    ? "team-flow-critical-stream"
                    : "team-flow-tester-stream";

                const speed = Math.max(1.6, 5.2 - link.total / 2.5);

                return (
                  <g key={link.id} opacity={isDim ? 0.08 : 1}>
                    {/* Primary Flow Track */}
                    <path
                      d={forwardPath}
                      fill="none"
                      stroke={strokeColor}
                      strokeOpacity={
                        isStreamHovered
                          ? 0.95
                          : isDim
                          ? 0.05
                          : isCriticalLink || isResolvedLink
                          ? 0.65
                          : 0.4
                      }
                      strokeWidth={
                        isStreamHovered
                          ? 4.5
                          : Math.min(4.5, 1.2 + link.total / 3)
                      }
                      strokeDasharray="6 10"
                      className={dashClass}
                    />

                    {/* Forward Particle (Tester ➔ Dev): Incoming open defects */}
                    {isOpenLink && (
                      <circle
                        r={isCriticalLink ? 3.5 : 2.5}
                        fill={isCriticalLink ? "#f43f5e" : "#38bdf8"}
                      >
                        <animateMotion
                          dur={`${speed}s`}
                          repeatCount="indefinite"
                          path={forwardPath}
                        />
                      </circle>
                    )}

                    {/* ── Return Particle (Developer ➔ Tester): Resolved Bug Flow ── */}
                    {isResolvedLink && (
                      <g>
                        {/* Reverse return path track for resolution feedback */}
                        <path
                          d={reversePath}
                          fill="none"
                          stroke="#10b981"
                          strokeOpacity={isStreamHovered ? 0.85 : 0.35}
                          strokeWidth={isStreamHovered ? 3 : 1.5}
                          strokeDasharray="4 8"
                          className="team-flow-resolved-dash"
                        />
                        {/* Glowing resolution particle flowing back from Dev to Tester */}
                        <circle r={isStreamHovered ? 4.5 : 3.2} fill="#10b981">
                          <animateMotion
                            dur={`${Math.max(1.8, speed * 0.85)}s`}
                            repeatCount="indefinite"
                            path={reversePath}
                          />
                        </circle>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Node Rendering (Testers on Left & Developers on Right) */}
              {[...positions.values()].map(({ x, y, node }) => {
                const isTester = node.side === "tester";
                const isDim =
                  hoveredStreamBug
                    ? !(
                        hoveredStreamBug.developerId === node.id ||
                        hoveredStreamBug.testerId === node.id
                      )
                    : active && !highlighted.has(node.id) && memberSearch === ""
                    ? true
                    : memberSearch.trim() &&
                      !node.name.toLowerCase().includes(memberSearch.toLowerCase())
                    ? true
                    : false;

                const r = radiusFor(node, maxTotal);
                const baseColor = isTester ? "#06b6d4" : "#818cf8";
                const isSelected = focus === node.id;
                const hasResolved = node.resolved > 0;
                const hasCritical = node.critical > 0;

                return (
                  <g
                    key={node.id}
                    opacity={isDim ? 0.16 : 1}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHover(node.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setFocus((prev) => (prev === node.id ? null : node.id))}
                  >
                    {/* Motion Halo / Pulse */}
                    <circle
                      cx={x}
                      cy={y}
                      r={r + (isSelected ? 10 : 7)}
                      fill="none"
                      stroke={
                        hasCritical
                          ? "#f43f5e"
                          : hasResolved
                          ? "#10b981"
                          : isTester
                          ? "#06b6d4"
                          : baseColor
                      }
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeOpacity={isSelected ? 0.9 : 0.45}
                      className={
                        hasCritical || isSelected
                          ? "team-flow-pulse"
                          : isTester
                          ? "team-flow-halo"
                          : undefined
                      }
                      style={{ transformOrigin: `${x}px ${y}px` }}
                    />

                    {/* Main Node Body */}
                    <circle
                      cx={x}
                      cy={y}
                      r={r}
                      fill={baseColor}
                      fillOpacity={isSelected ? 0.4 : 0.22}
                      stroke={baseColor}
                      strokeWidth={1.5}
                    />

                    {/* Center Core Indicator */}
                    <circle
                      cx={x}
                      cy={y}
                      r={4.5}
                      fill={
                        hasCritical
                          ? "#f43f5e"
                          : hasResolved
                          ? "#10b981"
                          : node.open > 0
                          ? "#38bdf8"
                          : baseColor
                      }
                    />

                    {/* Accessibility Tooltip */}
                    <title>
                      {`${node.unknown ? copy.unknownMember : node.name} · ${
                        copy.resolved
                      }: ${node.resolved} (${node.resolutionRate}%) · ${copy.open}: ${
                        node.open
                      } · ${copy.critical}: ${node.critical}`}
                    </title>

                    {/* Name Label — Strictly placed to prevent any overflow */}
                    <text
                      x={isTester ? x - r - 14 : x + r + 14}
                      y={y - 3}
                      textAnchor={isTester ? "end" : "start"}
                      className="fill-foreground font-mono text-[12px] font-semibold"
                    >
                      {shortLabel(node.unknown ? copy.unknownMember : node.name, 17)}
                    </text>

                    {/* Secondary stats label with motion contrast */}
                    <text
                      x={isTester ? x - r - 14 : x + r + 14}
                      y={y + 13}
                      textAnchor={isTester ? "end" : "start"}
                      className="fill-muted-foreground font-mono text-[10px]"
                    >
                      {isTester ? (
                        <>
                          <tspan className="fill-cyan-400 font-semibold">{node.total} {copy.errors}</tspan>
                          {node.resolved > 0 ? (
                            <tspan className="fill-emerald-400"> · {node.resolved} {copy.resolved}</tspan>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {node.resolved > 0 ? (
                            <tspan className="fill-emerald-400 font-semibold">
                              {node.resolved} {copy.resolved} ({node.resolutionRate}%) ·{" "}
                            </tspan>
                          ) : null}
                          <tspan>{node.open} {copy.open}</tspan>
                          {node.critical > 0 ? (
                            <tspan className="fill-rose-400 font-semibold">
                              {" "}· {node.critical} {copy.critical}
                            </tspan>
                          ) : null}
                        </>
                      )}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card */}
            {active && positions.get(active) && (
              <div className="pointer-events-none absolute top-3 end-3 max-w-[280px] rounded-xl border border-border/80 bg-card/98 p-3 text-xs shadow-xl backdrop-blur animate-in fade-in-50 duration-150 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="font-semibold text-foreground truncate">
                    {positions.get(active)!.node.unknown
                      ? copy.unknownMember
                      : positions.get(active)!.node.name}
                  </p>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase font-mono px-1.5 py-0"
                  >
                    {positions.get(active)!.node.role ?? positions.get(active)!.node.side}
                  </Badge>
                </div>

                {/* KPI metrics bar in tooltip */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-center font-mono">
                  <div className="rounded bg-muted/40 p-1">
                    <span className="text-[10px] text-muted-foreground block">{copy.resolved}</span>
                    <span className="font-bold text-emerald-500">
                      {positions.get(active)!.node.resolved}
                    </span>
                  </div>
                  <div className="rounded bg-muted/40 p-1">
                    <span className="text-[10px] text-muted-foreground block">{copy.open}</span>
                    <span className="font-bold text-amber-500">
                      {positions.get(active)!.node.open}
                    </span>
                  </div>
                  <div className="rounded bg-muted/40 p-1">
                    <span className="text-[10px] text-muted-foreground block">{copy.resolutionRate}</span>
                    <span className="font-bold text-primary">
                      {positions.get(active)!.node.resolutionRate}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Legend / Hint Bar */}
            <div className="pointer-events-none absolute bottom-2 start-3 end-3 flex flex-wrap items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>
                {graph.testers.length} {copy.testers} / {graph.developers.length} {copy.developers} ·{" "}
                {graph.links.length} {copy.links} · {graph.unassigned} {copy.unassigned}
              </span>
              <span className="hidden md:inline text-muted-foreground/80">{copy.hint}</span>
            </div>
          </div>

          {/* ── Deep Focus & Resolution Breakdown Panel ───────────────────── */}
          {focus && focusedNode && (
            <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3.5 shadow-sm animate-in fade-in-50 duration-200 overflow-hidden">
              {/* Header with Member KPIs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">
                        {focusedNode.unknown ? copy.unknownMember : focusedNode.name}
                      </h4>
                      <Badge variant="outline" className="text-[10px] font-mono capitalize shrink-0">
                        {focusedNode.role ?? focusedNode.side}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {focusedNode.total} {copy.errors} · {focusedNode.resolved} {copy.resolved} ({focusedNode.resolutionRate}%)
                    </p>
                  </div>
                </div>

                {/* Member Quick Links */}
                <div className="flex items-center gap-1.5">
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link to="/bugs" search={{ assignee: focus }}>
                      {copy.viewAll}
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setFocus(null)}
                  >
                    {copy.reset}
                  </Button>
                </div>
              </div>

              {/* Sub Tabs: Resolved vs Open vs All */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedTab("resolved");
                      setFocusedPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                      focusedTab === "resolved"
                        ? "bg-background text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{copy.tabResolved}</span>
                    <span className="rounded-full bg-emerald-500/10 px-1.5 text-[10px]">
                      {focusedNode.resolved}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusedTab("open");
                      setFocusedPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                      focusedTab === "open"
                        ? "bg-background text-amber-600 dark:text-amber-400 font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>{copy.tabOpen}</span>
                    <span className="rounded-full bg-amber-500/10 px-1.5 text-[10px]">
                      {focusedNode.open}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFocusedTab("all");
                      setFocusedPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-all ${
                      focusedTab === "all"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{copy.tabAll}</span>
                    <span className="rounded-full bg-muted px-1.5 text-[10px]">
                      {focusedNode.total}
                    </span>
                  </button>
                </div>

                {/* Bug search within member */}
                <div className="relative max-w-xs w-full sm:w-auto">
                  <Search className="absolute start-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={copy.searchBugs}
                    value={focusedSearch}
                    onChange={(e) => {
                      setFocusedSearch(e.target.value);
                      setFocusedPage(1);
                    }}
                    className="h-7 ps-8 text-xs"
                  />
                </div>
              </div>

              {/* Bug Cards Grid */}
              {focusedMemberBugs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                  {copy.liveTickerEmpty}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {focusedMemberBugs
                      .slice((focusedPage - 1) * 6, focusedPage * 6)
                      .map((bug) => {
                        const isResolved = RESOLVED_STATUSES.has(bug.status);
                        return (
                          <Link
                            key={bug.id}
                            to="/bugs/$id"
                            params={{ id: String(bug.id) }}
                            className="flex flex-col justify-between gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs transition-colors hover:border-primary/50 hover:bg-muted/40 min-w-0"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="font-mono font-semibold text-primary shrink-0">
                                {bug.bug_id}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {bug.priority && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9.5px] px-1 py-0 font-normal"
                                  >
                                    {bug.priority}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[9.5px] px-1.5 py-0 font-semibold ${
                                    isResolved
                                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "border-border/80"
                                  }`}
                                >
                                  {bug.status}
                                </Badge>
                              </div>
                            </div>

                            <p className="font-medium text-foreground line-clamp-1">{bug.title}</p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                              <span className="truncate">{bug.module ? `Module: ${bug.module}` : "General"}</span>
                              <span className="shrink-0 ps-1">
                                {formatDistanceToNow(
                                  new Date(bug.updated_at || bug.created_at),
                                  { addSuffix: true }
                                )}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                  </div>

                  <DashboardPagination
                    page={focusedPage}
                    totalItems={focusedMemberBugs.length}
                    pageSize={6}
                    onPageChange={setFocusedPage}
                    itemLabel="errors"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  const actions = (
    <div className="flex items-center gap-1">
      {focus ? (
        <Button size="sm" variant="ghost" className="h-8" onClick={() => setFocus(null)}>
          <RotateCcw className="h-3.5 w-3.5 me-1" />
          {copy.reset}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1"
        onClick={() => setExpanded((prev) => !prev)}
        aria-label={expanded ? copy.collapse : copy.expand}
      >
        {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        <span className="hidden sm:inline">{expanded ? copy.collapse : copy.expand}</span>
      </Button>
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-background/98 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Radar className="size-4 text-primary" />
            <h2 className="truncate text-sm font-semibold">{copy.title}</h2>
          </div>
          {actions}
        </div>
        <div className="min-w-0 rounded-xl border border-border/60 bg-card p-4">{body}</div>
      </div>
    );
  }

  return (
    <SectionCard title={copy.title} icon={Radar} action={actions}>
      {body}
    </SectionCard>
  );
}

export default TeamFlowMap;
