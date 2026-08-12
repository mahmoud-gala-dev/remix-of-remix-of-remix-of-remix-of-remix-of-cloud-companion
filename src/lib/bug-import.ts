import { BUG_PRIORITIES, BUG_SEVERITIES, BUG_STATUSES } from "@/lib/api";

export type ParsedBugImportRow = {
  excelRowNumber: number;
  bug_id: string;
  module: string;
  title: string;
  steps: string;
  environment: string;
  expected_result: string;
  actual_result: string;
  priority: string;
  severity: string;
  status: string;
  retest: string;
  role: string;
  notes: string;
};

export const BUG_IMPORT_HEADERS = [
  "Bug ID",
  "Module",
  "Title",
  "Steps to Reproduce",
  "Environment",
  "Expected Result",
  "Actual Result",
  "Priority",
  "Severity",
  "Reported By",
  "Status",
  "Retest",
  "Role",
  "Notes",
] as const;

export type BugImportValidation = {
  rows: ParsedBugImportRow[];
  missingHeaders: string[];
  unexpectedHeaders: string[];
  /** Fully blank spreadsheet rows that were skipped before validation. */
  skippedEmpty: number;
};

/** True when every data cell of the row is blank. */
export function isEmptyImportRow(row: ParsedBugImportRow) {
  const { excelRowNumber: _row, ...fields } = row;
  return Object.values(fields).every((value) => String(value ?? "").trim() === "");
}


export function normalizePriority(v: string) {
  const val = (v || "").trim();
  return (BUG_PRIORITIES as readonly string[]).includes(val) ? val : "Medium";
}

export function normalizeSeverity(v: string) {
  const val = (v || "").trim();
  return (BUG_SEVERITIES as readonly string[]).includes(val) ? val : "Minor";
}

export function normalizeStatus(v: string) {
  const val = (v || "").trim();
  return (BUG_STATUSES as readonly string[]).includes(val) ? val : "Open";
}

export function parseBugImportRows(rawData: unknown[][]): ParsedBugImportRow[] {
  return rawData
    .slice(2)
    .map((row, index) => {
      const vals = Object.values(row ?? []);
      return {
        excelRowNumber: index + 3,
        bug_id: vals[0]?.toString() ?? "",
        module: vals[1]?.toString() ?? "",
        title: vals[2]?.toString() ?? "",
        steps: vals[3]?.toString() ?? "",
        environment: vals[4]?.toString() ?? "",
        expected_result: vals[5]?.toString() ?? "",
        actual_result: vals[6]?.toString() ?? "",
        priority: vals[7]?.toString() ?? "",
        severity: vals[8]?.toString() ?? "",
        status: vals[10]?.toString() ?? "",
        retest: vals[11]?.toString() ?? "",
        role: vals[12]?.toString() ?? "",
        notes: vals[13]?.toString() ?? "",
      };
    })
    .filter((row) => !isEmptyImportRow(row) && row.bug_id !== row.module);
}

export function validateAndParseBugImportRows(rawData: unknown[][]): BugImportValidation {
  const headerRow = (rawData[1] ?? []).map((value) => String(value ?? "").trim());
  const expected = [...BUG_IMPORT_HEADERS];
  const rows = parseBugImportRows(rawData);
  const dataRowCount = rawData.slice(2).length;
  return {
    rows,
    missingHeaders: expected.filter((header, index) => headerRow[index] !== header),
    unexpectedHeaders: headerRow.filter(
      (header, index) => Boolean(header) && expected[index] !== header,
    ),
    skippedEmpty: Math.max(dataRowCount - rows.length, 0),
  };
}

