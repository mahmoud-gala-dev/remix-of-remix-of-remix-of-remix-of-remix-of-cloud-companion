import { describe, expect, it } from "vitest";
import { buildFlowGraph, relatedIds } from "./team-flow";

describe("team-flow", () => {
  it("computes resolved counts, resolution rates, and links properly", () => {
    const bugs = [
      {
        id: 1,
        bug_id: "BUG-1",
        title: "Auth failure",
        module: "Auth",
        reported_by: "u1",
        assigned_to: "u2",
        status: "Fixed",
        priority: "High",
        severity: "Major",
        created_at: "2026-08-14T10:00:00Z",
        updated_at: "2026-08-14T11:00:00Z",
      },
      {
        id: 2,
        bug_id: "BUG-2",
        title: "Crash on submit",
        module: "Checkout",
        reported_by: "u1",
        assigned_to: "u2",
        status: "Closed",
        priority: "Critical",
        severity: "Blocker",
        created_at: "2026-08-14T10:30:00Z",
        updated_at: "2026-08-14T12:00:00Z",
      },
      {
        id: 3,
        bug_id: "BUG-3",
        title: "UI glitch",
        module: "Dashboard",
        reported_by: "u1",
        assigned_to: "u2",
        status: "Open",
        priority: "Low",
        severity: "Minor",
        created_at: "2026-08-14T12:30:00Z",
        updated_at: "2026-08-14T12:30:00Z",
      },
    ];

    const names = { u1: "Tester Alice", u2: "Dev Bob" };
    const roles = { u1: "tester", u2: "developer" };

    const graph = buildFlowGraph(bugs, names, roles);

    expect(graph.testers.length).toBe(1);
    expect(graph.developers.length).toBe(1);

    const dev = graph.developers[0];
    expect(dev).toBeDefined();
    if (dev) {
      expect(dev.name).toBe("Dev Bob");
      expect(dev.total).toBe(3);
      expect(dev.resolved).toBe(2);
      expect(dev.open).toBe(1);
      expect(dev.critical).toBe(1);
      expect(dev.resolutionRate).toBe(67); // 2/3 = 67%
    }

    expect(graph.totalResolved).toBe(2);
    expect(graph.totalOpen).toBe(1);
    expect(graph.links.length).toBe(1);
    const link = graph.links[0];
    expect(link).toBeDefined();
    if (link) {
      expect(link.resolved).toBe(2);
      expect(link.open).toBe(1);
    }

    expect(graph.liveResolvedStream.length).toBe(2);
    const streamFirst = graph.liveResolvedStream[0];
    expect(streamFirst).toBeDefined();
    if (streamFirst) {
      expect(streamFirst.bugId).toBe("BUG-2"); // latest updated
      expect(streamFirst.developerName).toBe("Dev Bob");
      expect(streamFirst.testerName).toBe("Tester Alice");
    }

    const rel = relatedIds(graph, "u1");
    expect(rel.has("u1")).toBe(true);
    expect(rel.has("u2")).toBe(true);
  });
});
