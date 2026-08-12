import { EMPTY_BUG_FILTERS, type BugFilterState } from "@/components/bugs/BugFilters";

/**
 * Every field is optional so `<Link to="/bugs">` stays valid without repeating
 * the whole filter object; `parseBugsSearch` fills defaults when reading.
 */
export type BugsSearch = {
  q?: string;
  module?: string;
  status?: string;
  priority?: string;
  severity?: string;
  project?: string;
  assignee?: string;
  page?: number;
  view?: "table" | "board";
};

export type ResolvedBugsSearch = Required<BugsSearch>;

function str(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** Reads the bug list state out of the URL, tolerating any hand-edited value. */
export function parseBugsSearch(input: Record<string, unknown>): ResolvedBugsSearch {
  const page = Number(input["page"]);
  return {
    q: str(input["q"], ""),
    module: str(input["module"], "All"),
    status: str(input["status"], "All"),
    priority: str(input["priority"], "All"),
    severity: str(input["severity"], "All"),
    project: str(input["project"], "All"),
    assignee: str(input["assignee"], "All"),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    view: input["view"] === "board" ? "board" : "table",
  };
}

export function searchToFilterState(search: ResolvedBugsSearch): BugFilterState {
  return {
    ...EMPTY_BUG_FILTERS,
    search: search.q,
    module: search.module,
    status: search.status,
    priority: search.priority,
    severity: search.severity,
    project: search.project,
    assignee: search.assignee,
  };
}

/** Only non-default values end up in the URL, so shared links stay readable. */
export function filterStateToSearch(
  state: BugFilterState,
  extra: { page: number; view: "table" | "board" },
): Partial<BugsSearch> {
  const next: Partial<BugsSearch> = {};
  if (state.search.trim()) next.q = state.search;
  if (state.module !== "All") next.module = state.module;
  if (state.status !== "All") next.status = state.status;
  if (state.priority !== "All") next.priority = state.priority;
  if (state.severity !== "All") next.severity = state.severity;
  if (state.project !== "All") next.project = state.project;
  if (state.assignee !== "All") next.assignee = state.assignee;
  if (extra.page > 1) next.page = extra.page;
  if (extra.view === "board") next.view = "board";
  return next;
}
