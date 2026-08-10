import type { Bug, Profile } from "@/lib/api";

export type ProfileMap = Record<string, string>;

export function profilesToMap(profiles: Profile[] | undefined): ProfileMap {
  const map: ProfileMap = {};
  (profiles ?? []).forEach((p) => {
    map[p.id] = p.username ?? p.id.slice(0, 8);
  });
  return map;
}

export function nameFor(map: ProfileMap, id: string | null | undefined, fallbackName?: string) {
  if (!id) return fallbackName ?? "Unassigned";
  return map[id] ?? fallbackName ?? id.slice(0, 8);
}

export type BugWithRelations = Bug;
