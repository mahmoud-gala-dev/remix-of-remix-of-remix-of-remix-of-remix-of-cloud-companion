import { supabase } from "@/integrations/supabase/client";
import type { Bug, BugHistoryEntry, Profile, Project } from "@/lib/api";

export const RESOLVED_STATUSES = ["Fixed", "Closed"];

export async function fetchBugHistory(): Promise<BugHistoryEntry[]> {
  const { data, error } = await supabase
    .from("bug_history")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function isResolved(bug: Bug) {
  return RESOLVED_STATUSES.includes(bug.status);
}

/** Bugs grouped per project, split by status buckets. */
export function bugsByProject(bugs: Bug[], projects: Project[]) {
  const byId = new Map(projects.map((p) => [p.id, p.name]));
  const rows = new Map<
    string,
    { project: string; open: number; inProgress: number; resolved: number; total: number }
  >();

  for (const bug of bugs) {
    const key =
      bug.project_id != null
        ? (byId.get(bug.project_id) ?? `Project #${bug.project_id}`)
        : "Unassigned";
    const row = rows.get(key) ?? { project: key, open: 0, inProgress: 0, resolved: 0, total: 0 };
    row.total += 1;
    if (isResolved(bug)) row.resolved += 1;
    else if (bug.status === "In Progress") row.inProgress += 1;
    else row.open += 1;
    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => b.total - a.total);
}

/**
 * Resolution time per bug in hours: created_at -> first history entry moving
 * status into a resolved state (falls back to updated_at for resolved bugs
 * without history).
 */
export function resolutionTimes(bugs: Bug[], history: BugHistoryEntry[]) {
  const firstResolvedAt = new Map<number, string>();
  for (const entry of history) {
    if (entry.field !== "status") continue;
    if (!entry.new_value || !RESOLVED_STATUSES.includes(entry.new_value)) continue;
    if (!firstResolvedAt.has(entry.bug_id)) firstResolvedAt.set(entry.bug_id, entry.created_at);
  }

  const items: { bug: Bug; hours: number; resolvedAt: string }[] = [];
  for (const bug of bugs) {
    if (!isResolved(bug)) continue;
    const resolvedAt = firstResolvedAt.get(bug.id) ?? bug.updated_at;
    if (!resolvedAt || !bug.created_at) continue;
    const hours = (new Date(resolvedAt).getTime() - new Date(bug.created_at).getTime()) / 36e5;
    if (hours < 0) continue;
    items.push({ bug, hours, resolvedAt });
  }
  return items;
}

export function averageHours(items: { hours: number }[]) {
  if (!items.length) return 0;
  return items.reduce((sum, i) => sum + i.hours, 0) / items.length;
}

export function medianHours(items: { hours: number }[]) {
  if (!items.length) return 0;
  const sorted = items.map((i) => i.hours).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function formatDuration(hours: number) {
  if (!hours) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/** Top assignees by open vs resolved workload. */
export function assigneeLeaderboard(
  bugs: Bug[],
  profiles: Profile[],
  resolved: { bug: Bug; hours: number }[],
) {
  const names = new Map(profiles.map((p) => [p.id, p.username]));
  const avgByUser = new Map<string, { sum: number; count: number }>();
  for (const item of resolved) {
    const uid = item.bug.assigned_to;
    if (!uid) continue;
    const acc = avgByUser.get(uid) ?? { sum: 0, count: 0 };
    acc.sum += item.hours;
    acc.count += 1;
    avgByUser.set(uid, acc);
  }

  const rows = new Map<
    string,
    {
      userId: string;
      name: string;
      open: number;
      resolved: number;
      total: number;
      avgHours: number;
    }
  >();
  for (const bug of bugs) {
    if (!bug.assigned_to) continue;
    const uid = bug.assigned_to;
    const row = rows.get(uid) ?? {
      userId: uid,
      name: names.get(uid) ?? uid.slice(0, 8),
      open: 0,
      resolved: 0,
      total: 0,
      avgHours: 0,
    };
    row.total += 1;
    if (isResolved(bug)) row.resolved += 1;
    else row.open += 1;
    rows.set(uid, row);
  }

  for (const row of rows.values()) {
    const acc = avgByUser.get(row.userId);
    row.avgHours = acc && acc.count ? acc.sum / acc.count : 0;
  }

  return [...rows.values()].sort((a, b) => b.total - a.total);
}

/** Reported vs resolved counts bucketed by day for the last N days. */
export function trendSeries(bugs: Bug[], resolved: { resolvedAt: string }[], days: number) {
  const buckets: { date: string; label: string; reported: number; resolved: number }[] = [];
  const index = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    index.set(key, buckets.length);
    buckets.push({
      date: key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      reported: 0,
      resolved: 0,
    });
  }

  for (const bug of bugs) {
    const key = bug.created_at?.slice(0, 10);
    const i = key ? index.get(key) : undefined;
    if (i !== undefined) buckets[i]!.reported += 1;
  }
  for (const item of resolved) {
    const key = item.resolvedAt?.slice(0, 10);
    const i = key ? index.get(key) : undefined;
    if (i !== undefined) buckets[i]!.resolved += 1;
  }

  return buckets;
}
