import type { Bug } from "@/lib/api";

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
  critical: number;
};

/** A tester → developer relation, weighted by the number of shared errors. */
export type FlowLink = {
  id: string;
  from: string;
  to: string;
  total: number;
  open: number;
};

export type FlowGraph = {
  testers: FlowNode[];
  developers: FlowNode[];
  links: FlowLink[];
  unassigned: number;
};

const OPEN_STATUSES = new Set(["Open", "In Progress", "Reopened"]);

type FlowBug = Pick<Bug, "reported_by" | "assigned_to" | "status" | "priority" | "severity">;

/**
 * Turns a flat bug list into the tester/developer graph rendered by
 * `TeamFlowMap`. Pure so it stays unit-testable and cheap to memoise.
 */
export function buildFlowGraph(
  bugs: FlowBug[],
  names: Record<string, string>,
  roles: Record<string, string>,
): FlowGraph {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  let unassigned = 0;

  const touch = (id: string, side: FlowNode["side"], bug: FlowBug) => {
    const existing =
      nodes.get(id) ??
      ({
        id,
        name: names[id] ?? id.slice(0, 8),
        role: roles[id] ?? null,
        unknown: !names[id],
        side,
        total: 0,
        open: 0,
        critical: 0,
      } satisfies FlowNode);
    existing.total += 1;
    if (OPEN_STATUSES.has(bug.status)) existing.open += 1;
    if (bug.priority === "Critical" || bug.severity === "Blocker") existing.critical += 1;
    nodes.set(id, existing);
  };

  for (const bug of bugs) {
    const reporter = bug.reported_by ?? null;
    const assignee = bug.assigned_to ?? null;
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
        links.get(key) ?? ({ id: key, from: reporter, to: assignee, total: 0, open: 0 } as FlowLink);
      link.total += 1;
      if (OPEN_STATUSES.has(bug.status)) link.open += 1;
      links.set(key, link);
    }
  }

  const bySize = (a: FlowNode, b: FlowNode) => b.total - a.total || a.name.localeCompare(b.name);
  const all = [...nodes.values()];

  return {
    testers: all.filter((n) => n.side === "tester").sort(bySize),
    developers: all.filter((n) => n.side === "developer").sort(bySize),
    links: [...links.values()].sort((a, b) => b.total - a.total),
    unassigned,
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
