import { supabase } from "@/integrations/supabase/client";
import { friendlyDbError } from "@/lib/api";
import {
  generateBugId,
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
 * Resolves the single active developer assigned to a project, or `null`
 * when the project has zero or multiple developers (to avoid ambiguity).
 *
 * This is intentionally conservative: auto-assignment only fires when the
 * relationship is unambiguous (exactly one active developer in the project).
 */
async function resolveProjectDeveloper(projectId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("project_developers")
    .select("user_id")
    .eq("project_id", projectId);

  if (error || !data || data.length !== 1) return null;

  // Verify the developer's profile is still active before auto-assigning.
  const developerId = data[0]!.user_id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", developerId)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) return null;

  return developerId;
}

/**
 * Imports bugs from an Excel file built on the export template and attaches
 * every row to `projectId`. Shared by the bug list and the project page.
 *
 * @param file        The uploaded .xlsx / .xls file.
 * @param projectId   The project to attach bugs to (null = no project).
 * @param uploadedById  The id of the user who triggered the upload, recorded
 *                    in the new `excel_uploaded_by` column for traceability.
 * @param onProgress  Optional progress callback (current, total).
 */
export async function importBugsFromExcel({
  file,
  projectId,
  uploadedById,
  onProgress,
}: {
  file: File;
  projectId: number | null;
  /** Auth user id of whoever clicked "Import Excel". Stored as excel_uploaded_by. */
  uploadedById?: string | null;
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

  // Resolve auto-assignee: only when the project has exactly one active developer.
  const autoAssignedTo =
    projectId != null ? await resolveProjectDeveloper(projectId) : null;

  const failures: ExcelImportFailure[] = [];
  let imported = 0;
  let duplicates = 0;

  for (const [index, row] of validation.rows.entries()) {
    onProgress?.(index + 1, validation.rows.length);
    if (!row.title.trim()) {
      failures.push({
        excelRowNumber: row.excelRowNumber,
        bugId: row.bug_id,
        reason: "Title is required",
      });
      continue;
    }
    // Sheets without a Bug ID column get one generated automatically.
    if (!row.bug_id.trim()) row.bug_id = generateBugId(index + 1, existingIds);
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
      // The user who triggered the Excel upload — preserved for audit/display.
      reported_by: uploadedById ?? null,
      excel_uploaded_by: uploadedById ?? null,
      // Auto-assign to the sole project developer when the mapping is unambiguous.
      assigned_to: autoAssignedTo,
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
