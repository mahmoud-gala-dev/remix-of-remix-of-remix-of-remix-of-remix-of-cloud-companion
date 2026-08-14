import type { Bug } from "@/lib/api";

export type FlowRecentResolvedBug = {
  id: number;
  bugId: string;
  title: string;
  module: string | null;
  developerId: string;
  developerName: string;
  testerId: string | null;
  testerName: string | null;
  resolvedAt: string;
};

/** One person on the interactive map. */
export type FlowNode = {
  id: string;
  name: string;
  side: "tester" | "developer";
  /** Role from user_roles when known, e.g. developer / tester. */
  role: string | null;
  /** True when no profile row exists, so only the short id is available. */
  unknown: boolean;
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
  resolutionRate: number;
};

/** A tester → developer relation, weighted by the number of shared errors. */
export type FlowLink = {
  id: string;
  from: string;
  to: string;
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  critical: number;
};

export type FlowGraph = {
  testers: FlowNode[];
  developers: FlowNode[];
  links: FlowLink[];
  unassigned: number;
  totalResolved: number;
  totalOpen: number;
  totalCritical: number;
  liveResolvedStream: FlowRecentResolvedBug[];
};

const RESOLVED_STATUSES = new Set(["Fixed", "Closed", "Resolved"]);
const IN_PROGRESS_STATUSES = new Set(["In Progress"]);
const OPEN_STATUSES = new Set(["Open", "Reopened"]);

type FlowBug = Pick<
  Bug,
  "id" | "bug_id" | "title" | "module" | "reported_by" | "assigned_to" | "status" | "priority" | "severity" | "updated_at" | "created_at"
>;

/**
 * Turns a flat bug list into the interactive tester/developer graph rendered by
 * `TeamFlowMap`, including real-time resolution metrics and resolved bug streams.
 */
export function buildFlowGraph(
  bugs: FlowBug[],
  names: Record<string, string>,
  roles: Record<string, string>
): FlowGraph {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  let unassigned = 0;
  let totalResolved = 0;
  let totalOpen = 0;
  let totalCritical = 0;
  const liveResolvedStream: FlowRecentResolvedBug[] = [];

  const touch = (id: string, side: FlowNode["side"], bug: FlowBug) => {
    const existing =
      nodes.get(id) ??
      ({
        id,
        name: names[id] ?? "Deleted User",
        role: roles[id] ?? null,
        unknown: !names[id],
        side,
        total: 0,
        open: 0,
        inProgress: 0,
        resolved: 0,
        critical: 0,
        resolutionRate: 0,
      } satisfies FlowNode);

    existing.total += 1;
    if (RESOLVED_STATUSES.has(bug.status)) {
      existing.resolved += 1;
    } else if (IN_PROGRESS_STATUSES.has(bug.status)) {
      existing.inProgress += 1;
    } else if (OPEN_STATUSES.has(bug.status)) {
      existing.open += 1;
    } else {
      existing.open += 1;
    }

    if (bug.priority === "Critical" || bug.severity === "Blocker") {
      existing.critical += 1;
    }

    existing.resolutionRate =
      existing.total > 0 ? Math.round((existing.resolved / existing.total) * 100) : 0;

    nodes.set(id, existing);
  };

  for (const bug of bugs) {
    const reporter = bug.reported_by && names[bug.reported_by] ? bug.reported_by : null;
    const assignee = bug.assigned_to && names[bug.assigned_to] ? bug.assigned_to : null;

    const isResolved = RESOLVED_STATUSES.has(bug.status);
    const isInProgress = IN_PROGRESS_STATUSES.has(bug.status);
    const isOpen = OPEN_STATUSES.has(bug.status) || (!isResolved && !isInProgress);
    const isCritical = bug.priority === "Critical" || bug.severity === "Blocker";

    if (isResolved) totalResolved += 1;
    if (isOpen || isInProgress) totalOpen += 1;
    if (isCritical) totalCritical += 1;

    // Collect stream of resolved bugs (connecting developer who resolved it to the tester who reported it)
    if (isResolved && assignee) {
      liveResolvedStream.push({
        id: bug.id,
        bugId: bug.bug_id,
        title: bug.title,
        module: bug.module,
        developerId: assignee,
        developerName: names[assignee] ?? assignee.slice(0, 8),
        testerId: reporter,
        testerName: reporter ? names[reporter] ?? reporter.slice(0, 8) : null,
        resolvedAt: bug.updated_at || bug.created_at,
      });
    }

    if (reporter) {
      const role = roles[reporter];
      touch(reporter, role === "developer" ? "developer" : "tester", bug);
    }
    if (assignee) {
      const role = roles[assignee];
      touch(assignee, role === "tester" ? "tester" : "developer", bug);
    } else {
      unassigned += 1;
    }

    if (reporter && assignee && reporter !== assignee) {
      const key = `${reporter}->${assignee}`;
      const link =
        links.get(key) ??
        ({
          id: key,
          from: reporter,
          to: assignee,
          total: 0,
          open: 0,
          inProgress: 0,
          resolved: 0,
          critical: 0,
        } as FlowLink);

      link.total += 1;
      if (isResolved) link.resolved += 1;
      if (isInProgress) link.inProgress += 1;
      if (isOpen) link.open += 1;
      if (isCritical) link.critical += 1;

      links.set(key, link);
    }
  }

  // Sort live resolved stream newest first
  liveResolvedStream.sort(
    (a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime()
  );

  const bySize = (a: FlowNode, b: FlowNode) =>
    b.resolved - a.resolved || b.total - a.total || a.name.localeCompare(b.name);
  const all = [...nodes.values()];

  return {
    testers: all.filter((n) => n.side === "tester").sort(bySize),
    developers: all.filter((n) => n.side === "developer").sort(bySize),
    links: [...links.values()].sort((a, b) => b.resolved - a.resolved || b.total - a.total),
    unassigned,
    totalResolved,
    totalOpen,
    totalCritical,
    liveResolvedStream,
  };
}

/** Ids connected to the focused node (including itself), used for highlighting. */
export function relatedIds(graph: FlowGraph, focusId: string | null): Set<string> {
  const set = new Set<string>();
  if (!focusId) return set;
  set.add(focusId);
  for (const link of graph.links) {
    if (link.from === focusId) set.add(link.to);
    if (link.to === focusId) set.add(link.from);
  }
  return set;
}
