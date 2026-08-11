import { describe, expect, it } from "vitest";
import {
  moduleBreakdown,
  resolutionByPriority,
  statusDistribution,
  trendSeries,
} from "@/lib/analytics";

const now = new Date("2026-08-11T12:00:00.000Z");

function bug(overrides: Partial<Record<string, string>> = {}) {
  return {
    created_at: "2026-08-10T09:00:00.000Z",
    updated_at: "2026-08-11T09:00:00.000Z",
    status: "Open",
    priority: "High",
    module: "Billing",
    ...overrides,
  } as never;
}

describe("trendSeries", () => {
  it("buckets created and resolved bugs per day", () => {
    const series = trendSeries([bug(), bug({ status: "Fixed" })], 3, now);
    expect(series).toHaveLength(3);
    expect(series.at(-2)).toEqual({ day: "2026-08-10", created: 2, resolved: 0 });
    expect(series.at(-1)).toEqual({ day: "2026-08-11", created: 0, resolved: 1 });
  });

  it("ignores bugs outside the window", () => {
    const series = trendSeries([bug({ created_at: "2020-01-01T00:00:00.000Z" })], 2, now);
    expect(series.every((point) => point.created === 0)).toBe(true);
  });
});

describe("resolutionByPriority", () => {
  it("averages resolution hours and reports the SLA target", () => {
    const stats = resolutionByPriority([bug({ status: "Closed" }), bug()]);
    expect(stats).toEqual([{ priority: "High", resolved: 1, avgHours: 24, targetHours: 24 }]);
  });
});

describe("moduleBreakdown", () => {
  it("splits open and resolved per module", () => {
    const rows = moduleBreakdown([bug(), bug({ status: "Fixed" }), bug({ module: "" })]);
    expect(rows[0]).toEqual({ module: "Billing", open: 1, resolved: 1 });
    expect(rows[1]).toEqual({ module: "Unassigned", open: 1, resolved: 0 });
  });
});

describe("statusDistribution", () => {
  it("counts bugs per status, largest first", () => {
    const slices = statusDistribution([bug(), bug(), bug({ status: "Fixed" })]);
    expect(slices).toEqual([
      { name: "Open", value: 2 },
      { name: "Fixed", value: 1 },
    ]);
  });
});
