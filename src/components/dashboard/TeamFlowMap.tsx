import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { SectionCard, EmptyPanel } from "@/components/dashboard/dashboard-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { fetchBugs, fetchProfiles, fetchUserRoleMap, type Bug } from "@/lib/api";
import { buildFlowGraph, relatedIds, type FlowNode } from "@/lib/team-flow";

const COPY = {
  en: {
    title: "Team Flow Map",
    kicker: "testers → developers · live routing of every error",
    testers: "Testers",
    developers: "Developers",
    empty: "No routed errors yet",
    emptyDetail: "Once errors are reported and assigned, the flow between testers and developers appears here.",
    reset: "Fit",
    focus: "Focused",
    errors: "errors",
    open: "open",
    unassigned: "unassigned",
    links: "routes",
    hint: "hover a node to trace its routes · click to focus",
    related: "Related errors",
    viewAll: "Open in error list",
    unknownMember: "Deleted / unlinked account",
    idLabel: "account id",
    critical: "critical",
    roleLabel: "role",
  },
  ar: {
    title: "خريطة تفاعل الفريق",
    kicker: "المختبرون ← المطورون · مسار كل خطأ لحظيًا",
    testers: "المختبرون",
    developers: "المطورون",
    empty: "لا توجد أخطاء موجّهة بعد",
    emptyDetail: "بعد تسجيل الأخطاء وإسنادها سيظهر هنا مسار العمل بين المختبرين والمطورين.",
    reset: "إعادة الضبط",
    focus: "محدد",
    errors: "أخطاء",
    open: "مفتوحة",
    unassigned: "غير مُسندة",
    links: "مسارات",
    hint: "مرّر على أي عضو لتتبع مساراته · اضغط للتركيز",
    related: "الأخطاء المرتبطة",
    viewAll: "افتح في قائمة الأخطاء",
    unknownMember: "حساب محذوف أو غير مرتبط بملف تعريف",
    idLabel: "معرّف الحساب",
    critical: "حرجة",
    roleLabel: "الدور",
  },
} as const;

const WIDTH = 920;
const HEIGHT = 460;
const LEFT_X = 170;
const RIGHT_X = 750;

function laneY(index: number, count: number) {
  if (count <= 1) return HEIGHT / 2;
  const top = 70;
  const bottom = HEIGHT - 70;
  return top + (index * (bottom - top)) / (count - 1);
}

function radiusFor(node: FlowNode, max: number) {
  const scale = max > 0 ? node.total / max : 0;
  return 10 + scale * 12;
}

export function TeamFlowMap() {
  const { language } = useI18n();
  const copy = COPY[language === "ar" ? "ar" : "en"];
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const bugsQuery = useQuery({ queryKey: ["flow-bugs"], queryFn: fetchBugs, staleTime: 30_000 });
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

  const bugs = bugsQuery.data ?? [];
  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of profilesQuery.data ?? []) map[p.id] = p.username ?? p.id.slice(0, 8);
    return map;
  }, [profilesQuery.data]);

  const graph = useMemo(
    () => buildFlowGraph(bugs, names, rolesQuery.data ?? {}),
    [bugs, names, rolesQuery.data],
  );

  const active = hover ?? focus;
  const highlighted = useMemo(() => relatedIds(graph, active), [graph, active]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; node: FlowNode }>();
    graph.testers.forEach((node, index) =>
      map.set(node.id, { x: LEFT_X, y: laneY(index, graph.testers.length), node }),
    );
    graph.developers.forEach((node, index) =>
      map.set(node.id, { x: RIGHT_X, y: laneY(index, graph.developers.length), node }),
    );
    return map;
  }, [graph]);

  const maxTotal = Math.max(1, ...[...positions.values()].map((p) => p.node.total));
  const isLoading = bugsQuery.isLoading || profilesQuery.isLoading || rolesQuery.isLoading;

  const focusedBugs: Bug[] = useMemo(() => {
    if (!focus) return [];
    return bugs
      .filter((bug) => bug.reported_by === focus || bug.assigned_to === focus)
      .slice(0, 6);
  }, [bugs, focus]);

  return (
    <SectionCard
      title={copy.title}
      icon={Radar}
      action={
        focus ? (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setFocus(null)}>
            {copy.reset}
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : positions.size === 0 ? (
        <EmptyPanel title={copy.empty} detail={copy.emptyDetail} />
      ) : (
        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {copy.kicker}
          </p>

          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-[oklch(0.19_0.04_255)]">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full"
              role="img"
              aria-label={copy.title}
            >
              <defs>
                <radialGradient id="flow-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
                </radialGradient>
                <pattern id="flow-grid" width="46" height="46" patternUnits="userSpaceOnUse">
                  <path
                    d="M46 0H0V46"
                    fill="none"
                    stroke="var(--chart-2)"
                    strokeOpacity="0.12"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect width={WIDTH} height={HEIGHT} fill="url(#flow-grid)" />
              <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={230} fill="url(#flow-glow)" />
              <circle
                cx={WIDTH / 2}
                cy={HEIGHT / 2}
                r={180}
                fill="none"
                stroke="var(--chart-2)"
                strokeOpacity="0.18"
                strokeDasharray="3 8"
                className="team-flow-spin"
                style={{ transformOrigin: `${WIDTH / 2}px ${HEIGHT / 2}px` }}
              />

              <text
                x={LEFT_X}
                y={36}
                textAnchor="middle"
                className="fill-[var(--chart-3)] font-mono text-[13px] uppercase"
              >
                {copy.testers}
              </text>
              <text
                x={RIGHT_X}
                y={36}
                textAnchor="middle"
                className="fill-[var(--chart-2)] font-mono text-[13px] uppercase"
              >
                {copy.developers}
              </text>

              {graph.links.map((link) => {
                const a = positions.get(link.from);
                const b = positions.get(link.to);
                if (!a || !b) return null;
                const dim = active ? !(highlighted.has(link.from) && highlighted.has(link.to)) : false;
                const midY = (a.y + b.y) / 2 + (b.y > a.y ? -40 : 40);
                const path = `M${a.x} ${a.y} Q${WIDTH / 2} ${midY} ${b.x} ${b.y}`;
                return (
                  <g key={link.id} opacity={dim ? 0.12 : 1}>
                    <path
                      d={path}
                      fill="none"
                      stroke={link.open > 0 ? "var(--chart-1)" : "var(--chart-3)"}
                      strokeOpacity={0.55}
                      strokeWidth={Math.min(4, 1 + link.total / 4)}
                      strokeDasharray="6 10"
                      className="team-flow-dash"
                    />
                    <circle r={3} fill="var(--chart-2)">
                      <animateMotion dur={`${Math.max(2.4, 6 - link.total / 3)}s`} repeatCount="indefinite" path={path} />
                    </circle>
                  </g>
                );
              })}

              {[...positions.values()].map(({ x, y, node }) => {
                const dim = active ? !highlighted.has(node.id) : false;
                const r = radiusFor(node, maxTotal);
                const isTester = node.side === "tester";
                const color = isTester ? "var(--chart-3)" : "var(--chart-2)";
                return (
                  <g
                    key={node.id}
                    opacity={dim ? 0.2 : 1}
                    className="cursor-pointer"
                    onMouseEnter={() => setHover(node.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setFocus((prev) => (prev === node.id ? null : node.id))}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={r + 8}
                      fill="none"
                      stroke={color}
                      strokeOpacity={0.35}
                      className={node.critical > 0 ? "team-flow-pulse" : undefined}
                      style={{ transformOrigin: `${x}px ${y}px` }}
                    />
                    <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.22} stroke={color} />
                    <circle cx={x} cy={y} r={4} fill={node.open > 0 ? "var(--chart-1)" : color} />
                    <title>
                      {`${node.unknown ? copy.unknownMember : node.name} · ${copy.roleLabel}: ${
                        node.role ?? (isTester ? copy.testers : copy.developers)
                      } · ${node.total} ${copy.errors} · ${node.open} ${copy.open} · ${
                        node.critical
                      } ${copy.critical}${node.unknown ? ` · ${copy.idLabel}: ${node.id}` : ""}`}
                    </title>
                    <text
                      x={isTester ? x - r - 14 : x + r + 14}
                      y={y - 2}
                      textAnchor={isTester ? "end" : "start"}
                      className="fill-foreground font-mono text-[12px] font-semibold"
                    >
                      {node.unknown ? copy.unknownMember : node.name}
                    </text>
                    <text
                      x={isTester ? x - r - 14 : x + r + 14}
                      y={y + 13}
                      textAnchor={isTester ? "end" : "start"}
                      className="fill-muted-foreground font-mono text-[10px]"
                    >
                      {(node.role ?? (isTester ? "tester" : "developer")) + " · "}
                      {node.total} {copy.errors} · {node.open} {copy.open}
                      {node.critical > 0 ? ` · ${node.critical} ${copy.critical}` : ""}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="pointer-events-none absolute bottom-2 start-3 font-mono text-[10px] text-muted-foreground">
              {graph.testers.length} {copy.testers} / {graph.developers.length} {copy.developers} ·{" "}
              {graph.links.length} {copy.links} · {graph.unassigned} {copy.unassigned} · {copy.hint}
            </div>
          </div>

          {focus && (
            <div className="rounded-xl border border-border/60 bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {copy.related} · {names[focus] ?? focus.slice(0, 8)}
                </p>
                <Button asChild size="sm" variant="ghost" className="h-8">
                  <Link to="/bugs" search={{ assignee: focus }}>
                    {copy.viewAll}
                  </Link>
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {focusedBugs.map((bug) => (
                  <Link
                    key={bug.id}
                    to="/bugs/$id"
                    params={{ id: String(bug.id) }}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-xs text-muted-foreground">{bug.bug_id}</span>{" "}
                      {bug.title}
                    </span>
                    <Badge variant="outline">{bug.status}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

export default TeamFlowMap;
