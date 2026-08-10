import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError, type Bug, type BugTimeEntry, type Profile } from "@/lib/api";

export type BugResolutionEntry = BugTimeEntry;

export type ResolutionAnalyticsRow = {
  bugId: number;
  bugCode: string;
  title: string;
  module: string;
  projectId: number | null;
  developerId: string;
  developerName: string;
  totalSeconds: number;
  entries: number;
};

export type ProjectResolutionTotal = {
  projectId: number | null;
  label: string;
  totalSeconds: number;
  bugs: number;
};

const LOCAL_KEY = "electropi.local.bug_time_entries";

function projectTotalsFromRows(rows: ResolutionAnalyticsRow[]) {
  const projectMap = new Map<number | null, ProjectResolutionTotal>();
  rows.forEach((row) => {
    const current = projectMap.get(row.projectId) ?? {
      projectId: row.projectId,
      label: row.projectId ? `Project ${row.projectId}` : "No project",
      totalSeconds: 0,
      bugs: 0,
    };
    current.totalSeconds += row.totalSeconds;
    current.bugs += 1;
    projectMap.set(row.projectId, current);
  });
  return Array.from(projectMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function localEntries(): BugResolutionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "[]") as BugResolutionEntry[];
  } catch {
    return [];
  }
}

function saveLocalEntries(entries: BugResolutionEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
}

export async function fetchBugTimeEntries(bugId: number, userId?: string) {
  try {
    let query = supabase
      .from("bug_time_entries")
      .select("*")
      .eq("bug_id", bugId)
      .order("started_at", { ascending: false });
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) return localEntries().filter((entry) => entry.bug_id === bugId);
    return data ?? [];
  } catch {
    return localEntries().filter((entry) => entry.bug_id === bugId);
  }
}

export async function startBugTimer({ bugId, userId }: { bugId: number; userId: string }) {
  const startedAt = new Date().toISOString();
  try {
    const { error } = await supabase
      .from("bug_time_entries")
      .insert({ bug_id: bugId, user_id: userId, started_at: startedAt });
    if (error) throw new Error(friendlyDbError(error));
  } catch (error) {
    const entries = localEntries();
    if (
      entries.some((entry) => entry.bug_id === bugId && entry.user_id === userId && !entry.ended_at)
    ) {
      throw error instanceof Error ? error : new Error("A timer is already running.");
    }
    entries.unshift({
      id: -Date.now(),
      bug_id: bugId,
      user_id: userId,
      started_at: startedAt,
      ended_at: null,
      duration_seconds: null,
      created_at: startedAt,
      updated_at: startedAt,
    });
    saveLocalEntries(entries);
  }
}

export async function stopBugTimer(entry: BugResolutionEntry) {
  const ended = new Date();
  const seconds = Math.max(
    1,
    Math.round((ended.getTime() - new Date(entry.started_at).getTime()) / 1000),
  );
  if (entry.id < 0) {
    saveLocalEntries(
      localEntries().map((item) =>
        item.id === entry.id
          ? {
              ...item,
              ended_at: ended.toISOString(),
              duration_seconds: seconds,
              updated_at: ended.toISOString(),
            }
          : item,
      ),
    );
    return;
  }
  const { error } = await supabase
    .from("bug_time_entries")
    .update({
      ended_at: ended.toISOString(),
      duration_seconds: seconds,
      updated_at: ended.toISOString(),
    })
    .eq("id", entry.id);
  if (error) throw new Error(friendlyDbError(error));
}

export async function fetchResolutionAnalytics(): Promise<{
  rows: ResolutionAnalyticsRow[];
  projectTotals: ProjectResolutionTotal[];
}> {
  try {
    const { data, error } = await supabase.rpc("get_resolution_time_analytics");
    if (!error && data) {
      const rows = data.map((row) => ({
        bugId: Number(row.bug_id),
        bugCode: row.bug_code,
        title: row.title,
        module: row.module,
        projectId: row.project_id == null ? null : Number(row.project_id),
        developerId: row.developer_id,
        developerName: row.developer_name,
        totalSeconds: row.total_seconds,
        entries: row.entries,
      }));
      return { rows, projectTotals: projectTotalsFromRows(rows) };
    }
  } catch {
    // Fallback below supports databases that have not applied the analytics view/RPC yet.
  }

  const [{ data: entriesData, error: entriesError }, { data: bugsData }, { data: profilesData }] =
    await Promise.all([
      supabase.from("bug_time_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("bugs").select("id,bug_id,title,module,project_id"),
      supabase.from("profiles").select("*"),
    ]);

  const entries = entriesError ? localEntries() : (entriesData ?? []);
  const bugs = new Map(
    ((bugsData ?? []) as Pick<Bug, "id" | "bug_id" | "title" | "module" | "project_id">[]).map(
      (bug) => [bug.id, bug],
    ),
  );
  const profiles = new Map((profilesData ?? []).map((profile: Profile) => [profile.id, profile]));
  const grouped = new Map<string, ResolutionAnalyticsRow>();

  entries
    .filter((entry) => (entry.duration_seconds ?? 0) > 0)
    .forEach((entry) => {
      const bug = bugs.get(entry.bug_id);
      const key = `${entry.bug_id}:${entry.user_id}`;
      const current =
        grouped.get(key) ??
        ({
          bugId: entry.bug_id,
          bugCode: bug?.bug_id ?? `#${entry.bug_id}`,
          title: bug?.title ?? "Unknown bug",
          module: bug?.module ?? "Unassigned",
          projectId: bug?.project_id ?? null,
          developerId: entry.user_id,
          developerName: profiles.get(entry.user_id)?.username ?? entry.user_id.slice(0, 8),
          totalSeconds: 0,
          entries: 0,
        } satisfies ResolutionAnalyticsRow);
      current.totalSeconds += entry.duration_seconds ?? 0;
      current.entries += 1;
      grouped.set(key, current);
    });

  const rows = Array.from(grouped.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    rows,
    projectTotals: projectTotalsFromRows(rows),
  };
}
