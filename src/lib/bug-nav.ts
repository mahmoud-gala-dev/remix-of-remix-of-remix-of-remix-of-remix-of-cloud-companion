/**
 * Keeps the bug list's active filters/search available to the bug detail page so
 * the Previous / Next buttons walk exactly the same ordered result set the user
 * was looking at in the list (same sort, filters and search term).
 */
import { supabase } from "@/integrations/supabase/client";
import { applyBugFilters, type BugFilters, type BugQueryBuilder } from "@/lib/api";

export const BUG_NAV_KEY = "electropi.bugs.navfilters";

export function writeBugNavFilters(filters: BugFilters) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BUG_NAV_KEY, JSON.stringify(filters));
  } catch {
    /* storage may be unavailable (private mode) — navigation falls back to all bugs */
  }
}

export function readBugNavFilters(): BugFilters {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(BUG_NAV_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BugFilters | null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Ordered bug ids for the given filters, newest first (same order as the list). */
export async function fetchBugIdOrder(filters: BugFilters): Promise<number[]> {
  const base = supabase
    .from("bugs")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(2000);
  const query = applyBugFilters(base as unknown as BugQueryBuilder, filters);
  const { data, error } = (await (query as unknown as typeof base)) as {
    data: { id: number }[] | null;
    error: { message: string } | null;
  };
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}
