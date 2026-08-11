import { describe, expect, it } from "vitest";
import { ageHours, slaLabel, slaState, slaSummary, slaTargetHours } from "@/lib/sla";

const now = new Date("2026-08-11T12:00:00Z");
const hoursAgo = (hours: number) =>
  new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("sla", () => {
  it("uses per-priority targets with a fallback", () => {
    expect(slaTargetHours("Critical")).toBe(8);
    expect(slaTargetHours("Nonsense")).toBe(72);
  });

  it("measures age in hours and never goes negative", () => {
    expect(ageHours(hoursAgo(5), now)).toBeCloseTo(5);
    expect(ageHours(new Date(now.getTime() + 3_600_000).toISOString(), now)).toBe(0);
  });

  it("classifies open bugs by aging", () => {
    expect(slaState({ status: "Open", priority: "Critical", created_at: hoursAgo(1) }, now)).toBe(
      "ok",
    );
    expect(slaState({ status: "Open", priority: "Critical", created_at: hoursAgo(7) }, now)).toBe(
      "at-risk",
    );
    expect(slaState({ status: "Open", priority: "Critical", created_at: hoursAgo(20) }, now)).toBe(
      "breached",
    );
  });

  it("treats fixed and closed bugs as resolved", () => {
    expect(slaState({ status: "Fixed", priority: "Critical", created_at: hoursAgo(99) }, now)).toBe(
      "resolved",
    );
    expect(slaState({ status: "Closed", priority: "Low", created_at: hoursAgo(999) }, now)).toBe(
      "resolved",
    );
  });

  it("labels remaining and overdue time", () => {
    expect(slaLabel({ status: "Open", priority: "High", created_at: hoursAgo(30) }, now)).toBe(
      "6h overdue",
    );
    expect(slaLabel({ status: "Open", priority: "High", created_at: hoursAgo(4) }, now)).toBe(
      "20h left",
    );
  });

  it("summarises a list", () => {
    const bugs = [
      { status: "Open", priority: "Critical", created_at: hoursAgo(20) },
      { status: "Open", priority: "Critical", created_at: hoursAgo(7) },
      { status: "Open", priority: "Low", created_at: hoursAgo(1) },
      { status: "Fixed", priority: "Critical", created_at: hoursAgo(90) },
    ];
    expect(slaSummary(bugs, now)).toEqual({ atRisk: 1, breached: 1 });
  });
});
