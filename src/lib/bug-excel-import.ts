import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import {
  normalizePriority,
  normalizeSeverity,
  normalizeStatus,
  validateAndParseBugImportRows,
} from "@/lib/bug-import";

export type ExcelImportFailure = { excelRowNumber: number; bugId: string; reason: string };

export type ExcelImportResult = {
  filename: string;
  imported: number;
  duplicates: number;
  failures: ExcelImportFailure[];
};

function readAsBinary(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsBinaryString(file);
  });
}

/**
 * Imports bugs from an Excel file built on the export template and attaches
 * every row to `projectId`. Shared by the bug list and the project page.
 */
export async function importBugsFromExcel({
  file,
  projectId,
  onProgress,
}: {
  file: File;
  projectId: number | null;
  onProgress?: (current: number, total: number) => void;
}): Promise<ExcelImportResult> {
  const binary = await readAsBinary(file);
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(binary, { type: "binary" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Empty workbook");
  const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
    header: 1,
  }) as unknown[][];

  const validation = validateAndParseBugImportRows(rawData);
  if (validation.missingHeaders.length > 0) {
    throw new Error(`Missing columns: ${validation.missingHeaders.join(", ")}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("bugs")
    .select("id,bug_id")
    .limit(5000);
  if (existingError) throw new Error(friendlyDbError(existingError));
  const existingIds = new Set((existing ?? []).map((bug) => bug.bug_id));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const failures: ExcelImportFailure[] = [];
  let imported = 0;
  let duplicates = 0;

  for (const [index, row] of validation.rows.entries()) {
    onProgress?.(index + 1, validation.rows.length);
    if (!row.bug_id.trim() || !row.title.trim()) {
      failures.push({
        excelRowNumber: row.excelRowNumber,
        bugId: row.bug_id,
        reason: "Bug ID and Title are required",
      });
      continue;
    }
    if (existingIds.has(row.bug_id)) {
      duplicates++;
      continue;
    }
    const { error } = await supabase.from("bugs").insert({
      bug_id: row.bug_id,
      module: row.module || "General",
      title: row.title,
      steps: row.steps || null,
      environment: row.environment || null,
      expected_result: row.expected_result || null,
      actual_result: row.actual_result || null,
      priority: normalizePriority(row.priority),
      severity: normalizeSeverity(row.severity),
      status: normalizeStatus(row.status),
      retest: row.retest || null,
      role: row.role || null,
      notes: row.notes || null,
      project_id: projectId,
      reported_by: user?.id ?? null,
    });
    if (error) {
      failures.push({
        excelRowNumber: row.excelRowNumber,
        bugId: row.bug_id,
        reason: friendlyDbError(error),
      });
    } else {
      existingIds.add(row.bug_id);
      imported++;
    }
  }

  return { filename: file.name, imported, duplicates, failures };
}
