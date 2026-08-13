import { describe, expect, it } from "vitest";
import {
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  parseBugImportRows,
  validateAndParseBugImportRows,
  BUG_IMPORT_HEADERS,
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

  it("parses rows after the two-row heading, drops blank rows, keeps rows missing an ID", () => {
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
      ["", "", "", ""],
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
      // Kept on purpose so the import report can reject it with a reason.
      expect.objectContaining({ bug_id: "", module: "Auth" }),
    ]);
  });

  it("counts fully blank rows as skipped", () => {
    const result = validateAndParseBugImportRows([
      ["title"],
      [...BUG_IMPORT_HEADERS],
      ["BUG-2", "Auth", "Broken"],
      ["", "", ""],
      [],
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedEmpty).toBe(2);
  });


  it("validates the template header row and preserves Excel row numbers", () => {
    const valid = validateAndParseBugImportRows([
      ["title"],
      [...BUG_IMPORT_HEADERS],
      ["BUG-9", "Checkout", "Payment fails"],
    ]);
    expect(valid.missingHeaders).toEqual([]);
    expect(valid.rows[0]?.excelRowNumber).toBe(3);
  });

  it("accepts sheets without a Bug ID column and infers a title column", () => {
    const result = validateAndParseBugImportRows([
      ["Module", "Issue description", "Priority"],
      ["Checkout", "Payment button does nothing", "High"],
    ]);
    expect(result.missingHeaders).toEqual([]);
    expect(result.rows[0]?.title).toBe("Payment button does nothing");
    expect(result.rows[0]?.bug_id).toBe("");
  });
});

