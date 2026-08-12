/**
 * Excel helpers for the bug tracker: exporting the current view to .xlsx and
 * downloading a ready-to-fill import template. The parser in
 * `src/lib/bug-import.ts` skips the first two rows and reads columns by index,
 * so the template must keep that exact column order.
 */

import { BUG_IMPORT_HEADERS } from "@/lib/bug-import";

const TEMPLATE_HINTS = [
  "BUG-001",
  "Authentication",
  "Login button does nothing on mobile",
  "1- Open /login\n2- Tap Sign in",
  "Chrome 126 / iOS 17",
  "User is signed in",
  "Nothing happens",
  "High",
  "Major",
  "Tester name",
  "Open",
  "Pending",
  "Tester",
  "Optional extra context",
];

export type BugExportRow = Record<string, string | number | null>;

async function saveSheet(rows: (string | number | null)[][], filename: string, sheet: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = (rows[0] ?? []).map(() => ({ wch: 22 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheet);
  XLSX.writeFile(workbook, filename);
}

/** Template with a title row, the header row, then one example row. */
export async function downloadBugImportTemplate() {
  const width = BUG_IMPORT_HEADERS.length;
  const titleRow = ["ElectroPI — Bug Import Template", ...Array(width - 1).fill(null)];
  await saveSheet(
    [titleRow, [...BUG_IMPORT_HEADERS], TEMPLATE_HINTS],
    "electropi-bug-import-template.xlsx",
    "Bugs",
  );
}

/** Exports rows as .xlsx using the same column order as the import template. */
export async function downloadBugsExcel(
  rows: (string | number | null)[][],
  headers: readonly string[],
  filename: string,
) {
  await saveSheet([[...headers], ...rows], filename, "Bugs");
}
