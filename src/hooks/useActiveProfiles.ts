import { useMemo } from "react";
import type { Profile } from "@/lib/api";

/**
 * Filters a raw profiles list to only the ones whose account is active.
 *
 * `is_active` can be:
 *   - `true`  → active
 *   - `false` → deactivated by an admin
 *   - missing / `null` (legacy rows) → treated as active for backward compat
 *
 * Use this hook for every assignment / member dropdown so inactive users
 * never appear as selectable options, regardless of their role.
 *
 * @param profiles Raw profiles array (may be undefined while loading).
 * @returns Memoised array containing only active profiles. Stable reference
 *          when `profiles` hasn't changed so downstream `useMemo` deps work.
 */
export function useActiveProfiles(profiles: Profile[] | undefined): Profile[] {
  return useMemo(
    () => (profiles ?? []).filter((p) => p.is_active !== false),
    [profiles],
  );
}
