import { describe, expect, it } from "vitest";
import { csvCell, datedCsvFilename, toCsv } from "@/lib/csv-export";

describe("csv export helpers", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('a "quote"')).toBe('"a ""quote"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell(null)).toBe("");
  });

  it("builds a csv document from column definitions", () => {
    const csv = toCsv(
      [
        { id: 1, name: "Alpha" },
        { id: 2, name: "Beta, Inc" },
      ],
      [
        { header: "ID", value: (row) => row.id },
        { header: "Name", value: (row) => row.name },
      ],
    );

    expect(csv).toBe('ID,Name\r\n1,Alpha\r\n2,"Beta, Inc"');
  });

  it("uses an ISO date suffix for exported filenames", () => {
    expect(datedCsvFilename("bugs", new Date("2026-08-09T12:00:00Z"))).toBe("bugs-2026-08-09.csv");
  });
});
