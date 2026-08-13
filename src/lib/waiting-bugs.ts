/**
 * Waiting-Bugs store — persists in localStorage so the list survives page
 * refreshes and is not shared across sessions/devices (intentional: it is a
 * personal scratch-pad, not a team-visible status).
 *
 * Key: "electropi.waiting_bugs"
 */

export const WAITING_BUGS_KEY = "electropi.waiting_bugs";

export type WaitingBug = {
  id: number;
  bugId: string;
  title: string;
  addedAt: string; // ISO string
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function readRaw(): WaitingBug[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WAITING_BUGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as WaitingBug[];
  } catch {
    return [];
  }
}

function writeRaw(bugs: WaitingBug[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WAITING_BUGS_KEY, JSON.stringify(bugs));
  } catch {
    /* private-browsing / storage-quota — silently ignore */
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all waiting bugs, newest-first. */
export function getWaitingBugs(): WaitingBug[] {
  return readRaw().sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime(),
  );
}

/**
 * Adds a bug to the waiting list. If the bug is already present the existing
 * entry is promoted to the top (timestamp refreshed) instead of duplicating it.
 */
export function addWaitingBug(bug: Omit<WaitingBug, "addedAt">): WaitingBug[] {
  const existing = readRaw().filter((b) => b.id !== bug.id);
  const entry: WaitingBug = { ...bug, addedAt: new Date().toISOString() };
  const next = [entry, ...existing];
  writeRaw(next);
  return next;
}

/** Removes a single bug by its numeric database id. */
export function removeWaitingBug(bugDbId: number): WaitingBug[] {
  const next = readRaw().filter((b) => b.id !== bugDbId);
  writeRaw(next);
  return next;
}

/** Checks whether a bug is already in the waiting list. */
export function isWaiting(bugDbId: number): boolean {
  return readRaw().some((b) => b.id === bugDbId);
}

/** Wipes the entire waiting list. */
export function clearWaitingBugs(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(WAITING_BUGS_KEY);
  }
}

/** Total count — cheap to call for badge numbers. */
export function waitingBugsCount(): number {
  return readRaw().length;
}
