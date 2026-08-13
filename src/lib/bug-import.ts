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
  /** Columns that were successfully matched in the uploaded file. */
  recognizedHeaders?: string[];
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
  "Bug ID": ["bugid", "id", "code", "bugcode", "ref", "reference", "key", "ticket", "معرفالخطأ", "رقمالخطأ", "الرقم", "الكود"],
  Module: ["module", "area", "feature", "component", "screen", "page", "الموديول", "الوحدة", "الشاشة"],
  Title: [
    "title",
    "summary",
    "name",
    "subject",
    "description",
    "desc",
    "issue",
    "issuetitle",
    "problem",
    "bugtitle",
    "bugname",
    "errortitle",
    "errorname",

    "العنوان",
    "الوصف",
    "المشكلة",
    "اسمالخطأ",
    "الخطأ",
    "وصفالخطأ",
  ],
  "Steps to Reproduce": ["stepstoreproduce", "steps", "repro", "reproduction", "خطواتالتكرار", "الخطوات"],
  Environment: ["environment", "env", "platform", "device", "browser", "البيئة"],
  "Expected Result": ["expectedresult", "expected", "shouldbe", "النتيجةالمتوقعة", "المتوقع"],
  "Actual Result": ["actualresult", "actual", "النتيجةالفعلية", "الفعلي"],
  Priority: ["priority", "الأولوية", "الاولوية"],
  Severity: ["severity", "impact", "الخطورة"],
  "Reported By": ["reportedby", "reporter", "createdby", "بواسطة", "المُبلغ", "المبلغ"],
  Status: ["status", "state", "الحالة"],
  Retest: ["retest", "verification", "إعادةالاختبار", "اعادةالاختبار"],
  Role: ["role", "الدور"],
  Notes: ["notes", "note", "comments", "comment", "remarks", "ملاحظات"],
};

/** Loose contains-match so "Bug Title (EN)" still maps to Title. */
function fuzzyHeaderMatch(cell: string, aliases: string[]) {
  if (!cell) return false;
  return aliases.some(
    (alias) => alias.length >= 4 && (cell.includes(alias) || alias.includes(cell)),
  );
}

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
    const taken = new Set<number>();
    let exactMatches = 0;
    // Exact/alias pass first, then a fuzzy "contains" pass for leftovers.
    for (const pass of ["exact", "fuzzy"] as const) {
      for (const header of expected) {
        if (indexes[header] !== undefined) continue;
        const aliases = [normalizeHeader(header), ...(HEADER_ALIASES[header] ?? [])];
        const index = cells.findIndex(
          (cell, i) =>
            cell !== "" &&
            !taken.has(i) &&
            (pass === "exact" ? aliases.includes(cell) : fuzzyHeaderMatch(cell, aliases)),
        );
        if (index >= 0) {
          indexes[header] = index;
          taken.add(index);
          if (pass === "exact") exactMatches++;
        }
      }
    }
    // Two exact column names are enough to trust the row as a header row.
    if (exactMatches >= 2 && exactMatches > best.matches)
      best = { rowIndex, matches: exactMatches, indexes };
  }

  return best;
}


/**
 * When no Title column can be matched by name, pick the column that looks most
 * like free text (longest average textual content) so imports still work.
 */
function inferTitleIndex(rawData: unknown[][], startRow: number, used: Set<number>) {
  const scores = new Map<number, { total: number; count: number }>();
  for (const raw of rawData.slice(startRow, startRow + 40)) {
    const cells = Object.values(raw ?? []) as unknown[];
    cells.forEach((cell, index) => {
      if (used.has(index)) return;
      const value = String(cell ?? "").trim();
      if (!value || /^[\d.,\-/:\s]+$/.test(value)) return;
      const entry = scores.get(index) ?? { total: 0, count: 0 };
      entry.total += value.length;
      entry.count += 1;
      scores.set(index, entry);
    });
  }
  let bestIndex = -1;
  let bestScore = 0;
  for (const [index, { total, count }] of scores) {
    if (count === 0) continue;
    const score = total / count;
    if (score > bestScore && score >= 4) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

/** Resolved column layout: header row position plus per-column indexes. */
export function resolveBugImportColumns(rawData: unknown[][]) {
  const header = locateHeaderRow(rawData);
  const hadHeaderRow = header.rowIndex >= 0;
  const indexes = { ...header.indexes };
  // Without a recognizable header row we assume the export template layout.
  const startRow = hadHeaderRow ? header.rowIndex + 1 : 2;
  if (!hadHeaderRow) {
    BUG_IMPORT_HEADERS.forEach((name, index) => {
      indexes[name] = index;
    });
  }
  if (indexes["Title"] === undefined) {
    const inferred = inferTitleIndex(rawData, startRow, new Set(Object.values(indexes)));
    if (inferred >= 0) indexes["Title"] = inferred;
  }
  return { startRow, indexes, matches: header.matches, hadHeaderRow };
}


export function parseBugImportRows(rawData: unknown[][]): ParsedBugImportRow[] {
  const { startRow, indexes } = resolveBugImportColumns(rawData);
  const at = (row: unknown[], name: string, fallbackIndex: number) => {
    const index = indexes[name] ?? fallbackIndex;
    return row[index]?.toString().trim() ?? "";
  };

  return rawData
    .slice(startRow)
    .map((raw, index) => {
      const vals = Object.values(raw ?? []) as unknown[];
      return {
        excelRowNumber: startRow + index + 1,
        bug_id: at(vals, "Bug ID", -1),
        module: at(vals, "Module", -1),
        title: at(vals, "Title", -1),
        steps: at(vals, "Steps to Reproduce", -1),
        environment: at(vals, "Environment", -1),
        expected_result: at(vals, "Expected Result", -1),
        actual_result: at(vals, "Actual Result", -1),
        priority: at(vals, "Priority", -1),
        severity: at(vals, "Severity", -1),
        status: at(vals, "Status", -1),
        retest: at(vals, "Retest", -1),
        role: at(vals, "Role", -1),
        notes: at(vals, "Notes", -1),
      };
    })
    .filter((row) => !isEmptyImportRow(row) && !(row.bug_id !== "" && row.bug_id === row.module));
}

/** Stable-ish auto id used when the sheet has no Bug ID column or a blank cell. */
export function generateBugId(seed: number, taken?: Set<string>) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  let candidate = `BUG-${stamp}-${String(seed).padStart(3, "0")}`;
  let bump = seed;
  while (taken?.has(candidate)) {
    bump += 1;
    candidate = `BUG-${stamp}-${String(bump).padStart(3, "0")}`;
  }
  return candidate;
}

export function validateAndParseBugImportRows(rawData: unknown[][]): BugImportValidation {
  const { startRow, indexes } = resolveBugImportColumns(rawData);
  const expected = [...BUG_IMPORT_HEADERS];
  const rows = parseBugImportRows(rawData);
  const dataRowCount = rawData.slice(startRow).length;
  // Bug IDs are generated when absent, so only a usable Title column is required.
  const missingHeaders = indexes["Title"] === undefined && rows.length > 0 ? ["Title"] : [];
  const headerCells = (rawData[Math.max(startRow - 1, 0)] ?? []).map((value) =>
    String(value ?? "").trim(),
  );
  const matchedIndexes = new Set(Object.values(indexes));
  return {
    rows,
    missingHeaders,
    unexpectedHeaders: headerCells.filter(
      (cell, index) => Boolean(cell) && !matchedIndexes.has(index),
    ),
    skippedEmpty: Math.max(dataRowCount - rows.length, 0),
    recognizedHeaders: expected.filter((name) => indexes[name] !== undefined),
  };
}



