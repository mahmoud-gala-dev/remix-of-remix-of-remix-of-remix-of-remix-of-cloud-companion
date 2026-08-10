import { describe, expect, it } from "vitest";
import {
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  parseBugImportRows,
} from "@/lib/bug-import";

describe("bug import helpers", () => {
  it("normalizes invalid enum-like values", () => {
    expect(normalizePriority("Critical")).toBe("Critical");
    expect(normalizePriority("Urgent")).toBe("Medium");
    expect(normalizeSeverity("Blocker")).toBe("Blocker");
    expect(normalizeSeverity("Urgent")).toBe("Minor");
    expect(normalizeStatus("Fixed")).toBe("Fixed");
    expect(normalizeStatus("Done")).toBe("Open");
  });

  it("parses worksheet rows after the two-row heading and skips invalid rows", () => {
    const rows = parseBugImportRows([
      ["title"],
      ["headers"],
      [
        "BUG-1",
        "Auth",
        "Login fails",
        "steps",
        "Chrome",
        "ok",
        "error",
        "High",
        "Major",
        "",
        "Open",
      ],
      ["", "Auth"],
      ["same", "same"],
    ]);

    expect(rows).toEqual([
      expect.objectContaining({
        bug_id: "BUG-1",
        module: "Auth",
        title: "Login fails",
        priority: "High",
        severity: "Major",
        status: "Open",
      }),
    ]);
  });
});
