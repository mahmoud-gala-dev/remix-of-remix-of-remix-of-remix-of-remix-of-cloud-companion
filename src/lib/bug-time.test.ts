import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchBugTimeEntries,
  fetchResolutionAnalytics,
  formatDuration,
  startBugTimer,
  stopBugTimer,
  type BugResolutionEntry,
} from "@/lib/bug-time";

type SupabaseResult = { data?: unknown; error?: unknown };

const tableHandlers = new Map<string, () => unknown>();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => tableHandlers.get(table)?.()),
  },
}));

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

function setBrowserStorage() {
  const localStorage = createStorage();
  Object.defineProperty(globalThis, "window", {
    value: { localStorage },
    configurable: true,
  });
  return localStorage;
}

function bugTimeTable({
  selectOrder = async () => ({ data: [], error: null }),
  insert = async () => ({ error: null }),
  update = async () => ({ error: null }),
}: {
  selectOrder?: () => Promise<SupabaseResult>;
  insert?: () => Promise<SupabaseResult>;
  update?: () => Promise<SupabaseResult>;
}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(selectOrder),
    insert: vi.fn(insert),
    update: vi.fn(() => ({ eq: vi.fn(update) })),
  };
  return query;
}

const localKey = "electropi.local.bug_time_entries";

describe("bug resolution time service", () => {
  beforeEach(() => {
    vi.useRealTimers();
    tableHandlers.clear();
    setBrowserStorage().clear();
  });

  it("formats durations as HH:MM:SS", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(65)).toBe("00:01:05");
    expect(formatDuration(3661.9)).toBe("01:01:01");
  });

  it("falls back to local entries when the bug_time_entries query fails", async () => {
    window.localStorage.setItem(
      localKey,
      JSON.stringify([
        { id: -1, bug_id: 7, user_id: "dev-1", duration_seconds: 20 },
        { id: -2, bug_id: 8, user_id: "dev-1", duration_seconds: 40 },
      ]),
    );
    tableHandlers.set("bug_time_entries", () =>
      bugTimeTable({ selectOrder: async () => ({ data: null, error: { message: "missing" } }) }),
    );

    const entries = await fetchBugTimeEntries(7);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.bug_id).toBe(7);
  });

  it("stores a local running entry when starting a timer offline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:00:00.000Z"));
    tableHandlers.set("bug_time_entries", () =>
      bugTimeTable({ insert: async () => ({ error: { message: "offline" } }) }),
    );

    await startBugTimer({ bugId: 10, userId: "dev-1" });

    const entries = JSON.parse(
      window.localStorage.getItem(localKey) ?? "[]",
    ) as BugResolutionEntry[];
    expect(entries).toMatchObject([
      {
        bug_id: 10,
        user_id: "dev-1",
        started_at: "2026-08-10T10:00:00.000Z",
        ended_at: null,
      },
    ]);
  });

  it("prevents duplicate local running timers for the same developer and bug", async () => {
    tableHandlers.set("bug_time_entries", () =>
      bugTimeTable({ insert: async () => ({ error: { message: "offline" } }) }),
    );

    await startBugTimer({ bugId: 10, userId: "dev-1" });

    await expect(startBugTimer({ bugId: 10, userId: "dev-1" })).rejects.toThrow(/offline/i);
  });

  it("stops local timers and persists the elapsed seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T10:02:05.000Z"));
    const entry = {
      id: -1,
      bug_id: 10,
      user_id: "dev-1",
      started_at: "2026-08-10T10:00:00.000Z",
      ended_at: null,
      duration_seconds: null,
      created_at: "2026-08-10T10:00:00.000Z",
      updated_at: "2026-08-10T10:00:00.000Z",
    } satisfies BugResolutionEntry;
    window.localStorage.setItem(localKey, JSON.stringify([entry]));

    await stopBugTimer(entry);

    const [stored] = JSON.parse(
      window.localStorage.getItem(localKey) ?? "[]",
    ) as BugResolutionEntry[];
    expect(stored?.ended_at).toBe("2026-08-10T10:02:05.000Z");
    expect(stored?.duration_seconds).toBe(125);
  });

  it("aggregates local resolution entries by bug, developer, and project", async () => {
    window.localStorage.setItem(
      localKey,
      JSON.stringify([
        { id: -1, bug_id: 10, user_id: "dev-1", duration_seconds: 120 },
        { id: -2, bug_id: 10, user_id: "dev-1", duration_seconds: 30 },
        { id: -3, bug_id: 11, user_id: "dev-2", duration_seconds: 60 },
      ]),
    );
    tableHandlers.set("bug_time_entries", () =>
      bugTimeTable({ selectOrder: async () => ({ data: null, error: { message: "missing" } }) }),
    );
    tableHandlers.set("bugs", () => ({
      select: vi.fn(async () => ({
        data: [
          { id: 10, bug_id: "BUG-10", title: "Login bug", module: "Auth", project_id: 3 },
          { id: 11, bug_id: "BUG-11", title: "Export bug", module: "Reports", project_id: 3 },
        ],
        error: null,
      })),
    }));
    tableHandlers.set("profiles", () => ({
      select: vi.fn(async () => ({
        data: [
          { id: "dev-1", username: "Developer One" },
          { id: "dev-2", username: "Developer Two" },
        ],
        error: null,
      })),
    }));

    const analytics = await fetchResolutionAnalytics();

    expect(analytics.rows).toEqual([
      expect.objectContaining({
        bugId: 10,
        developerName: "Developer One",
        totalSeconds: 150,
        entries: 2,
      }),
      expect.objectContaining({ bugId: 11, developerName: "Developer Two", totalSeconds: 60 }),
    ]);
    expect(analytics.projectTotals).toEqual([
      expect.objectContaining({ projectId: 3, totalSeconds: 210, bugs: 2 }),
    ]);
  });
});
