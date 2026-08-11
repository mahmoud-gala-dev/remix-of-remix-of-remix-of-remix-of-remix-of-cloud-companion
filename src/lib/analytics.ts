import type { Bug } from "@/lib/api";
import { RESOLVED_STATUSES, slaTargetHours } from "@/lib/sla";

export type TrendPoint = {
  day: string;
  created: number;
  resolved: number;
};

const DAY_MS = 86_400_000;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function isResolved(status: string | null | undefined) {
  return RESOLVED_STATUSES.includes(status ?? "");
}

/**
 * Daily created vs resolved counts for the last `days` days (oldest first).
 * A bug counts as resolved on the day it was last updated while in a
 * resolved status — the closest signal available without a closed_at column.
 */
export function trendSeries(
  bugs: Pick<Bug, "created_at" | "updated_at" | "status">[],
  days = 30,
  now: Date = new Date(),
): TrendPoint[] {
  const points = new Map<string, TrendPoint>();
  const start = new Date(now.getTime() - (days - 1) * DAY_MS);
  for (let index = 0; index < days; index += 1) {
    const key = new Date(start.getTime() + index * DAY_MS).toISOString().slice(0, 10);
    points.set(key, { day: key, created: 0, resolved: 0 });
  }

  for (const bug of bugs) {
    const created = points.get(dayKey(bug.created_at));
    if (created) created.created += 1;
    if (isResolved(bug.status)) {
      const resolved = points.get(dayKey(bug.updated_at));
      if (resolved) resolved.resolved += 1;
    }
  }

  return Array.from(points.values());
}

export type PriorityStat = {
  priority: string;
  resolved: number;
  avgHours: number;
  targetHours: number;
};

/** Average hours from report to resolution, grouped by priority. */
export function resolutionByPriority(
  bugs: Pick<Bug, "created_at" | "updated_at" | "status" | "priority">[],
): PriorityStat[] {
  const totals = new Map<string, { hours: number; count: number }>();
  for (const bug of bugs) {
    if (!isResolved(bug.status)) continue;
    const hours =
      (new Date(bug.updated_at).getTime() - new Date(bug.created_at).getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours < 0) continue;
    const priority = bug.priority || "Unknown";
    const entry = totals.get(priority) ?? { hours: 0, count: 0 };
    entry.hours += hours;
    entry.count += 1;
    totals.set(priority, entry);
  }

  return Array.from(totals.entries())
    .map(([priority, entry]) => ({
      priority,
      resolved: entry.count,
      avgHours: Math.round((entry.hours / entry.count) * 10) / 10,
      targetHours: slaTargetHours(priority),
    }))
    .sort((a, b) => b.avgHours - a.avgHours);
}

export type ModuleStat = { module: string; open: number; resolved: number };

/** Open vs resolved bugs per module, biggest backlog first. */
export function moduleBreakdown(
  bugs: Pick<Bug, "module" | "status">[],
  limit = 8,
): ModuleStat[] {
  const totals = new Map<string, ModuleStat>();
  for (const bug of bugs) {
    const module = bug.module || "Unassigned";
    const entry = totals.get(module) ?? { module, open: 0, resolved: 0 };
    if (isResolved(bug.status)) entry.resolved += 1;
    else entry.open += 1;
    totals.set(module, entry);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.open + b.resolved - (a.open + a.resolved))
    .slice(0, limit);
}

export type StatusSlice = { name: string; value: number };

export function statusDistribution(bugs: Pick<Bug, "status">[]): StatusSlice[] {
  const totals = new Map<string, number>();
  for (const bug of bugs) {
    const status = bug.status || "Unknown";
    totals.set(status, (totals.get(status) ?? 0) + 1);
  }
  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Short "Aug 11" style label for chart axes. */
export function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
