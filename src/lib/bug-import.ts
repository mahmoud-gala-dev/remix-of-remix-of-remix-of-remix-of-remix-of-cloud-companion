import { BUG_PRIORITIES, BUG_SEVERITIES, BUG_STATUSES } from "@/lib/api";

export type ParsedBugImportRow = {
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
    .map((row) => {
      const vals = Object.values(row ?? []);
      return {
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
    .filter((row) => row.bug_id.trim() !== "" && row.bug_id !== row.module);
}
