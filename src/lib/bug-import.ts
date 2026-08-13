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

/** Loose comparison so "Bug ID", "bug_id" and " BUG-ID " all match. */
function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s_\-.]+/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  "Bug ID": ["bugid", "id", "code", "bugcode", "معرفالخطأ", "رقمالخطأ"],
  Module: ["module", "area", "feature", "الموديول", "الوحدة"],
  Title: ["title", "summary", "name", "العنوان"],
  "Steps to Reproduce": ["stepstoreproduce", "steps", "repro", "خطواتالتكرار", "الخطوات"],
  Environment: ["environment", "env", "البيئة"],
  "Expected Result": ["expectedresult", "expected", "النتيجةالمتوقعة"],
  "Actual Result": ["actualresult", "actual", "النتيجةالفعلية"],
  Priority: ["priority", "الأولوية", "الاولوية"],
  Severity: ["severity", "الخطورة"],
  "Reported By": ["reportedby", "reporter", "بواسطة", "المُبلغ", "المبلغ"],
  Status: ["status", "state", "الحالة"],
  Retest: ["retest", "إعادةالاختبار", "اعادةالاختبار"],
  Role: ["role", "الدور"],
  Notes: ["notes", "note", "comments", "ملاحظات"],
};

/**
 * Finds the row that holds the column headers (files exported elsewhere may or
 * may not have a title row) and maps each expected column to its index.
 */
export function locateHeaderRow(rawData: unknown[][]) {
  const expected = [...BUG_IMPORT_HEADERS];
  let best = { rowIndex: -1, matches: 0, indexes: {} as Record<string, number> };

  for (let rowIndex = 0; rowIndex < Math.min(rawData.length, 10); rowIndex++) {
    const cells = (rawData[rowIndex] ?? []).map(normalizeHeader);
    const indexes: Record<string, number> = {};
    let matches = 0;
    for (const header of expected) {
      const aliases = [normalizeHeader(header), ...(HEADER_ALIASES[header] ?? [])];
      const index = cells.findIndex((cell) => cell !== "" && aliases.includes(cell));
      if (index >= 0) {
        indexes[header] = index;
        matches++;
      }
    }
    if (matches > best.matches) best = { rowIndex, matches, indexes };
  }

  return best;
}

export function parseBugImportRows(rawData: unknown[][]): ParsedBugImportRow[] {
  const header = locateHeaderRow(rawData);
  const startRow = header.rowIndex >= 0 ? header.rowIndex + 1 : 2;
  const at = (row: unknown[], name: string, fallbackIndex: number) => {
    const index = header.indexes[name] ?? fallbackIndex;
    return row[index]?.toString().trim() ?? "";
  };

  return rawData
    .slice(startRow)
    .map((raw, index) => {
      const vals = Object.values(raw ?? []) as unknown[];
      return {
        excelRowNumber: startRow + index + 1,
        bug_id: at(vals, "Bug ID", 0),
        module: at(vals, "Module", 1),
        title: at(vals, "Title", 2),
        steps: at(vals, "Steps to Reproduce", 3),
        environment: at(vals, "Environment", 4),
        expected_result: at(vals, "Expected Result", 5),
        actual_result: at(vals, "Actual Result", 6),
        priority: at(vals, "Priority", 7),
        severity: at(vals, "Severity", 8),
        status: at(vals, "Status", 10),
        retest: at(vals, "Retest", 11),
        role: at(vals, "Role", 12),
        notes: at(vals, "Notes", 13),
      };
    })
    .filter((row) => !isEmptyImportRow(row) && row.bug_id !== row.module);
}

export function validateAndParseBugImportRows(rawData: unknown[][]): BugImportValidation {
  const header = locateHeaderRow(rawData);
  const expected = [...BUG_IMPORT_HEADERS];
  const rows = parseBugImportRows(rawData);
  const startRow = header.rowIndex >= 0 ? header.rowIndex + 1 : 2;
  const dataRowCount = rawData.slice(startRow).length;
  // Only Bug ID and Title are structurally required; the rest can be absent.
  const required = ["Bug ID", "Title"];
  const missingHeaders = required.filter((name) => header.indexes[name] === undefined);
  const headerCells = (rawData[Math.max(header.rowIndex, 0)] ?? []).map((value) =>
    String(value ?? "").trim(),
  );
  const matchedIndexes = new Set(Object.values(header.indexes));
  return {
    rows,
    missingHeaders,
    unexpectedHeaders: headerCells.filter(
      (cell, index) => Boolean(cell) && !matchedIndexes.has(index),
    ),
    skippedEmpty: Math.max(dataRowCount - rows.length, 0),
    recognizedHeaders: expected.filter((name) => header.indexes[name] !== undefined),
  };
}


