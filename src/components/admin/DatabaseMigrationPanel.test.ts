import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMigrationChecks } from "@/lib/migration-checks";

type SupabaseResult = { data?: unknown; error?: unknown };

const tableHandlers = new Map<string, () => unknown>();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => tableHandlers.get(table)?.()),
  },
}));

function migrationTable(result: SupabaseResult) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => result),
  };
  return query;
}

describe("database migration checks", () => {
  beforeEach(() => {
    tableHandlers.clear();
  });

  it("marks migration checks as applied when timer table and oversight roles are reachable", async () => {
    tableHandlers.set("bug_time_entries", () => migrationTable({ data: [], error: null }));
    tableHandlers.set("resolution_time_analytics", () => migrationTable({ data: [], error: null }));
    tableHandlers.set("user_roles", () =>
      migrationTable({
        data: [{ role: "auditor" }, { role: "monitor" }, { role: "developer" }],
        error: null,
      }),
    );

    const checks = await fetchMigrationChecks();

    expect(checks).toEqual([
      expect.objectContaining({ key: "bug_time_entries", applied: true }),
      expect.objectContaining({ key: "demo_roles", applied: true }),
      expect.objectContaining({ key: "resolution_time_analytics", applied: true }),
    ]);
  });

  it("reports pending setup when the timer table or roles are missing", async () => {
    tableHandlers.set("bug_time_entries", () =>
      migrationTable({ data: null, error: { message: "relation does not exist" } }),
    );
    tableHandlers.set("user_roles", () =>
      migrationTable({ data: [{ role: "developer" }], error: null }),
    );
    tableHandlers.set("resolution_time_analytics", () =>
      migrationTable({ data: null, error: { message: "relation does not exist" } }),
    );

    const checks = await fetchMigrationChecks();

    expect(checks).toEqual([
      expect.objectContaining({
        key: "bug_time_entries",
        applied: false,
        detail: expect.stringMatching(/missing table/i),
      }),
      expect.objectContaining({
        key: "demo_roles",
        applied: false,
        detail: expect.stringMatching(/not seeded/i),
      }),
      expect.objectContaining({
        key: "resolution_time_analytics",
        applied: false,
        detail: expect.stringMatching(/missing analytics/i),
      }),
    ]);
  });
});
