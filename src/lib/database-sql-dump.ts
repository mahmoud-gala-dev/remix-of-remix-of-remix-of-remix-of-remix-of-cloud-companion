import { supabase } from "@/integrations/supabase/client";

export interface DatabaseDumpStats {
  timestamp: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
}

export interface DatabaseDumpResult {
  sql: string;
  stats: DatabaseDumpStats;
  filename: string;
}

/**
 * Safely format any JS value into a standard PostgreSQL SQL literal.
 */
export function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }

  if (Array.isArray(value)) {
    const elements = value.map((el) => {
      if (typeof el === "string") {
        return `"${el.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      }
      return String(el);
    });
    return `'${"{" + elements.join(",") + "}"}'`;
  }

  if (typeof value === "object") {
    const jsonString = JSON.stringify(value).replace(/'/g, "''");
    return `'${jsonString}'::jsonb`;
  }

  if (typeof value === "string") {
    const escaped = value.replace(/'/g, "''");
    return `'${escaped}'`;
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Generates an INSERT statement with ON CONFLICT DO UPDATE for a single table.
 */
export function generateTableSql(
  tableName: string,
  rows: Record<string, unknown>[],
  primaryKey = "id",
): string {
  if (!rows || rows.length === 0) {
    return `-- Table: ${tableName} (0 records)\n`;
  }

  const columnSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columnSet.add(key);
    }
  }
  const columns = Array.from(columnSet);

  const lines: string[] = [];
  lines.push(`-- ====================================================================`);
  lines.push(`-- Table: ${tableName} (${rows.length} records)`);
  lines.push(`-- ====================================================================`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const valueRows = batch.map((row) => {
      const values = columns.map((col) => formatSqlValue(row[col]));
      return `  (${values.join(", ")})`;
    });

    const nonPkColumns = columns.filter((col) => col !== primaryKey);
    let onConflictClause = `ON CONFLICT (${primaryKey}) DO NOTHING`;
    if (nonPkColumns.length > 0) {
      const updates = nonPkColumns.map((col) => `"${col}" = EXCLUDED."${col}"`).join(", ");
      onConflictClause = `ON CONFLICT (${primaryKey}) DO UPDATE SET ${updates}`;
    }

    const statement = `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")})\nVALUES\n${valueRows.join(",\n")}\n${onConflictClause};`;
    lines.push(statement);
  }

  const sampleId = rows[0]?.[primaryKey];
  if (typeof sampleId === "number") {
    lines.push(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', '${primaryKey}'), coalesce(max("${primaryKey}"), 0) + 1, false) FROM "${tableName}";`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Ordered list of tables to dump and restore in foreign-key safe order.
 */
export const DUMP_TABLES_ORDER = [
  { table: "profiles", pk: "id" },
  { table: "user_roles", pk: "id" },
  { table: "projects", pk: "id" },
  { table: "project_developers", pk: "id" },
  { table: "bugs", pk: "id" },
  { table: "bug_history", pk: "id" },
  { table: "bug_relations", pk: "id" },
  { table: "bug_dev_notes", pk: "id" },
  { table: "bug_time_entries", pk: "id" },
  { table: "attachments", pk: "id" },
  { table: "comments", pk: "id" },
  { table: "tasks", pk: "id" },
  { table: "task_time_entries", pk: "id" },
  { table: "improvements", pk: "id" },
  { table: "improvement_comments", pk: "id" },
  { table: "project_messages", pk: "id" },
  { table: "message_reactions", pk: "id" },
  { table: "notifications", pk: "id" },
  { table: "app_settings", pk: "id" },
] as const;

/**
 * Fetches all database records and compiles a full SQL dump.
 */
export async function generateFullDatabaseSql(): Promise<DatabaseDumpResult> {
  const timestamp = new Date().toISOString();
  const tableCounts: Record<string, number> = {};
  let totalRecords = 0;

  const sqlChunks: string[] = [];

  sqlChunks.push(`-- ====================================================================`);
  sqlChunks.push(`-- ElectroPI Bug Tracker — Full Database SQL Backup`);
  sqlChunks.push(`-- Timestamp: ${timestamp}`);
  sqlChunks.push(`-- Database: PostgreSQL / Supabase`);
  sqlChunks.push(`-- Description: Complete schema records and relations dump`);
  sqlChunks.push(`-- ====================================================================`);
  sqlChunks.push(``);
  sqlChunks.push(`BEGIN;`);
  sqlChunks.push(`SET statement_timeout = 0;`);
  sqlChunks.push(`SET client_encoding = 'UTF8';`);
  sqlChunks.push(``);

  for (const { table, pk } of DUMP_TABLES_ORDER) {
    try {
      const { data, error } = await supabase.from(table as never).select("*");
      if (error) {
        console.warn(`Could not export table ${table}:`, error.message);
        sqlChunks.push(`-- Warning: Table "${table}" could not be exported: ${error.message}\n`);
        continue;
      }

      const rows = (data ?? []) as Record<string, unknown>[];
      tableCounts[table] = rows.length;
      totalRecords += rows.length;

      if (rows.length > 0) {
        const tableSql = generateTableSql(table, rows, pk);
        sqlChunks.push(tableSql);
      } else {
        sqlChunks.push(`-- Table "${table}": 0 records\n`);
      }
    } catch (err) {
      console.warn(`Error during export of table ${table}:`, err);
    }
  }

  sqlChunks.push(`-- ====================================================================`);
  sqlChunks.push(`-- End of Backup Dump · Total Records: ${totalRecords}`);
  sqlChunks.push(`-- ====================================================================`);
  sqlChunks.push(`COMMIT;`);
  sqlChunks.push(``);

  const sql = sqlChunks.join("\n");
  const dateFormatted = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `electropi_database_backup_${dateFormatted}.sql`;

  return {
    sql,
    stats: {
      timestamp,
      totalRecords,
      tableCounts,
    },
    filename,
  };
}

/**
 * Triggers a browser download for the generated SQL dump.
 */
export async function downloadDatabaseSqlBackup(): Promise<DatabaseDumpStats> {
  const result = await generateFullDatabaseSql();
  const blob = new Blob([result.sql], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return result.stats;
}

/**
 * Fast table summary fetcher for the Settings UI.
 */
export async function fetchDatabaseTableStats(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  await Promise.allSettled(
    DUMP_TABLES_ORDER.map(async ({ table }) => {
      try {
        const { count, error } = await supabase
          .from(table as never)
          .select("*", { count: "exact", head: true });
        if (!error && typeof count === "number") {
          counts[table] = count;
        } else {
          counts[table] = 0;
        }
      } catch {
        counts[table] = 0;
      }
    }),
  );

  return counts;
}
