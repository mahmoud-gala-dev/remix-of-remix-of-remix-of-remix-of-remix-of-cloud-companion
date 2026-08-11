import { supabase } from "@/integrations/supabase/client";

export type GlobalSearchHit =
  | { kind: "bug"; id: number; label: string; sublabel: string }
  | { kind: "project"; id: number; label: string; sublabel: string }
  | { kind: "task"; id: number; label: string; sublabel: string };

export type GlobalSearchResults = {
  bugs: GlobalSearchHit[];
  projects: GlobalSearchHit[];
  tasks: GlobalSearchHit[];
};

export const EMPTY_SEARCH_RESULTS: GlobalSearchResults = { bugs: [], projects: [], tasks: [] };

/** Escapes a term for a PostgREST `or(...)` expression. */
export function escapeSearchTerm(term: string) {
  return term
    .replace(/[(),\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Searches bugs, projects and priority tasks in one pass.
 * RLS decides what each role is allowed to see, so no extra filtering is needed here.
 */
export async function globalSearch(rawTerm: string, limit = 6): Promise<GlobalSearchResults> {
  const term = escapeSearchTerm(rawTerm);
  if (term.length < 2) return EMPTY_SEARCH_RESULTS;

  const [bugs, projects, tasks] = await Promise.all([
    supabase
      .from("bugs")
      .select("id,bug_id,title,status,module")
      .or(`title.ilike.%${term}%,bug_id.ilike.%${term}%,module.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("projects")
      .select("id,name,key,status")
      .or(`name.ilike.%${term}%,key.ilike.%${term}%`)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("tasks")
      .select("id,title,status,priority")
      .ilike("title", `%${term}%`)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  return {
    bugs: (bugs.data ?? []).map((row) => ({
      kind: "bug" as const,
      id: Number(row.id),
      label: `${row.bug_id} — ${row.title}`,
      sublabel: `${row.module} · ${row.status}`,
    })),
    projects: (projects.data ?? []).map((row) => ({
      kind: "project" as const,
      id: Number(row.id),
      label: row.name,
      sublabel: `${row.key} · ${row.status}`,
    })),
    tasks: (tasks.data ?? []).map((row) => ({
      kind: "task" as const,
      id: Number(row.id),
      label: row.title,
      sublabel: `${row.priority} · ${row.status}`,
    })),
  };
}
