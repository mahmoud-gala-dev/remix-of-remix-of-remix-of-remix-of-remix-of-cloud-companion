import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type Bug = Database["public"]["Tables"]["bugs"]["Row"];
export type BugInsert = Database["public"]["Tables"]["bugs"]["Insert"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Attachment = Database["public"]["Tables"]["attachments"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type BugHistoryEntry = Database["public"]["Tables"]["bug_history"]["Row"];
export type BugTimeEntry = Database["public"]["Tables"]["bug_time_entries"]["Row"];

export const BUG_STATUSES = ["Open", "In Progress", "Fixed", "Reopened", "Closed"] as const;
export const BUG_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const BUG_SEVERITIES = ["Minor", "Major", "Critical", "Blocker"] as const;
export const TASK_STATUSES = ["Pending", "In Progress", "Done"] as const;
export const ROLES = ["admin", "developer", "tester", "supervisor", "auditor", "monitor"] as const;

/** Storage bucket holding uploaded bug attachments (private). */
export const ATTACHMENTS_BUCKET = "bug-attachments";

/** Map of user id -> username, for rendering reporter/assignee names. */
export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("username");
  if (error) throw error;
  return data ?? [];
}

/** Map of user id -> role, used to restrict pickers (e.g. assignee) by role. */
export async function fetchUserRoleMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("user_roles").select("user_id, role");
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.user_id] = row.role as string;
  return map;
}


export function getLocalMockProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("electropi.mock.projects");
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore malformed local mock data and fall back to an empty list.
  }
  return [];
}

export function getLocalMockBugs(): Bug[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("electropi.mock.bugs");
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore malformed local mock data and fall back to an empty list.
  }
  return [];
}

export async function fetchProjects(): Promise<Project[]> {
  const localMocks = getLocalMockProjects();
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return localMocks;
    const dbProjects = data ?? [];
    const existingKeys = new Set(dbProjects.map((p) => p.key));
    const uniqueMocks = localMocks.filter((p) => !existingKeys.has(p.key));
    return [...dbProjects, ...uniqueMocks];
  } catch {
    return localMocks;
  }
}

export async function fetchBugs(): Promise<Bug[]> {
  const localMocks = getLocalMockBugs();
  try {
    const { data, error } = await supabase
      .from("bugs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return localMocks;
    const dbBugs = data ?? [];
    const existingBugIds = new Set(dbBugs.map((b) => b.bug_id));
    const uniqueMocks = localMocks.filter((b) => !existingBugIds.has(b.bug_id));
    return [...dbBugs, ...uniqueMocks];
  } catch {
    return localMocks;
  }
}

/* ------------------------------------------------------------------ *
 * Server-side filtering + pagination
 * ------------------------------------------------------------------ */

export const BUG_LIST_COLUMNS =
  "id,bug_id,title,module,status,priority,severity,project_id,assigned_to,reported_by,created_at";

export type BugListRow = Pick<
  Bug,
  | "id"
  | "bug_id"
  | "title"
  | "module"
  | "status"
  | "priority"
  | "severity"
  | "project_id"
  | "assigned_to"
  | "reported_by"
  | "created_at"
>;

export type BugFilters = {
  /** "All" (or empty) means "no filter" for every field below. */
  status?: string;
  priority?: string;
  severity?: string;
  module?: string;
  /** Project id as a string, or "All". */
  project?: string;
  /** Assignee user id, "All", or "unassigned". */
  assignee?: string;
  /** Free text matched against title and bug_id. */
  search?: string;
  /** Restrict to bugs reported by / assigned to a given user. */
  reportedBy?: string;
  assignedTo?: string;
};

/** Minimal shape of the postgrest builder we use — keeps the builder unit-testable. */
export type BugQueryBuilder = {
  eq: (column: string, value: unknown) => BugQueryBuilder;
  is: (column: string, value: unknown) => BugQueryBuilder;
  or: (filter: string) => BugQueryBuilder;
};

const isSet = (value: string | undefined | null) =>
  !!value && value !== "All" && value.trim() !== "";

/** Escape a value for use inside a PostgREST `or(...)` expression. */
export function escapeOrValue(value: string) {
  return value
    .replace(/[(),\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Applies every active filter to a PostgREST query builder.
 * Pure and dependency-free so it can be unit tested with a fake builder.
 */
export function applyBugFilters<T extends BugQueryBuilder>(query: T, filters: BugFilters): T {
  let q: BugQueryBuilder = query;
  if (isSet(filters.status)) q = q.eq("status", filters.status);
  if (isSet(filters.priority)) q = q.eq("priority", filters.priority);
  if (isSet(filters.severity)) q = q.eq("severity", filters.severity);
  if (isSet(filters.module)) q = q.eq("module", filters.module);
  if (isSet(filters.project)) q = q.eq("project_id", Number(filters.project));
  if (filters.assignee === "unassigned") q = q.is("assigned_to", null);
  else if (isSet(filters.assignee)) q = q.eq("assigned_to", filters.assignee);
  if (isSet(filters.reportedBy)) q = q.eq("reported_by", filters.reportedBy);
  if (isSet(filters.assignedTo)) q = q.eq("assigned_to", filters.assignedTo);
  const search = filters.search?.trim();
  if (search) {
    const safe = escapeOrValue(search);
    if (safe) q = q.or(`title.ilike.%${safe}%,bug_id.ilike.%${safe}%`);
  }
  return q as T;
}

/** Inclusive [from, to] range for a 1-based page. */
export function pageRange(page: number, pageSize: number) {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export async function fetchBugsPage(input: {
  page: number;
  pageSize: number;
  filters: BugFilters;
}): Promise<{ rows: BugListRow[]; count: number }> {
  const { from, to } = pageRange(input.page, input.pageSize);
  const localMocks = getLocalMockBugs() as unknown as BugListRow[];

  try {
    const base = supabase
      .from("bugs")
      .select(BUG_LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    const query = applyBugFilters(base as unknown as BugQueryBuilder, input.filters);
    const { data, error, count } = (await (query as unknown as typeof base)) as {
      data: BugListRow[] | null;
      error: { message: string } | null;
      count: number | null;
    };
    if (error) {
      return { rows: localMocks, count: localMocks.length };
    }
    const dbRows = data ?? [];
    const existingBugIds = new Set(dbRows.map((b) => b.bug_id));
    const uniqueMocks = localMocks.filter((b) => !existingBugIds.has(b.bug_id));
    const combined = [...dbRows, ...uniqueMocks];
    return { rows: combined, count: (count ?? 0) + uniqueMocks.length };
  } catch {
    return { rows: localMocks, count: localMocks.length };
  }
}

/** Distinct module names, used to build the module tab strip. */
export async function fetchBugModules(): Promise<string[]> {
  const { data, error } = await supabase.from("bugs").select("module").limit(2000);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.module).filter(Boolean))).sort();
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates (computed in the database)
 * ------------------------------------------------------------------ */

export type DashboardScope = "all" | "assigned" | "reported";

export type DashboardStats = {
  total: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_severity: Record<string, number>;
  by_module: { module: string; total: number; open: number; fixed: number }[];
  modules: string[];
};

export async function fetchDashboardStats(scope: DashboardScope): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("bug_dashboard_stats", { _scope: scope });
  if (error) throw error;
  const raw = (data ?? {}) as Partial<DashboardStats>;
  return {
    total: raw.total ?? 0,
    by_status: raw.by_status ?? {},
    by_priority: raw.by_priority ?? {},
    by_severity: raw.by_severity ?? {},
    by_module: raw.by_module ?? [],
    modules: raw.modules ?? [],
  };
}

export async function fetchRecentBugs(
  scope: DashboardScope,
  userId: string | undefined,
  limit = 6,
): Promise<BugListRow[]> {
  const filters: BugFilters = {};
  if (scope === "assigned" && userId) filters.assignedTo = userId;
  if (scope === "reported" && userId) filters.reportedBy = userId;
  const base = supabase
    .from("bugs")
    .select(BUG_LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  const query = applyBugFilters(base as unknown as BugQueryBuilder, filters);
  const { data, error } = (await (query as unknown as typeof base)) as {
    data: BugListRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return data ?? [];
}

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

export function statusTone(status: string) {
  switch (status) {
    case "Open":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "In Progress":
      return "bg-info/15 text-info border-info/30";
    case "Fixed":
    case "Done":
      return "bg-success/15 text-success border-success/30";
    case "Reopened":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function priorityTone(value: string) {
  switch (value) {
    case "Critical":
    case "Blocker":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "High":
    case "Major":
      return "bg-warning/15 text-warning border-warning/30";
    case "Medium":
      return "bg-info/15 text-info border-info/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Maximum size of an uploaded attachment (50MB). */
export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

/** Content types accepted for attachment uploads. */
export const ALLOWED_ATTACHMENT_TYPES = ["image/", "application/pdf", "video/"] as const;

/** Returns an error message when the file may not be uploaded, otherwise null. */
export function validateAttachmentFile(file: { name: string; type: string; size: number }) {
  const allowed = ALLOWED_ATTACHMENT_TYPES.some((t) => file.type.startsWith(t));
  if (!allowed) return `${file.name}: only images, videos, and PDF files can be uploaded.`;
  if (file.size > MAX_ATTACHMENT_BYTES)
    return `${file.name} is larger than ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB.`;
  return null;
}

/**
 * Attachment contents are either a storage object path, a legacy base64 data
 * URL, or an external link. Only storage paths need a signed URL.
 */
export function isStoragePath(content: string) {
  return !/^(data:|https?:|blob:)/i.test(content);
}

/** Only http(s) links may be stored as link attachments. */

export function isSafeHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Turns raw Postgres errors into something a human can act on. */
export function friendlyDbError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "Something went wrong.";
  if (error?.code === "23505" || /duplicate key value/i.test(message)) {
    if (/bugs_bug_id_key|bug_id/.test(message)) return "That Bug ID is already in use.";
    if (/projects_key_key|\bkey\b/.test(message)) return "That project key is already in use.";
    return "That value already exists.";
  }
  if (error?.code === "42501" || /row-level security/i.test(message)) {
    return "You do not have permission to perform this action.";
  }
  if (/violates check constraint/i.test(message))
    return "One of the selected values is not allowed.";
  return message;
}
