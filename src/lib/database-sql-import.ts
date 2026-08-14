import { supabase } from "@/integrations/supabase/client";
import { DUMP_TABLES_ORDER } from "@/lib/database-sql-dump";

export interface ParsedSqlTableData {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface DatabaseImportResult {
  success: boolean;
  totalImported: number;
  tableStats: Record<string, number>;
  errors: string[];
}

/**
 * Parses raw SQL literal value back to JavaScript representation.
 */
export function parseSqlLiteral(raw: string): unknown {
  const trimmed = raw.trim();

  if (trimmed === "" || trimmed.toUpperCase() === "NULL") {
    return null;
  }

  if (trimmed.toUpperCase() === "TRUE") return true;
  if (trimmed.toUpperCase() === "FALSE") return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  // String literal with single quotes: 'something' or 'something'::jsonb or 'something'::timestamptz
  const stringMatch = trimmed.match(/^'((?:[^']|'')*)'(?:::[\w\s]+)?$/s);
  if (stringMatch) {
    const unescaped = (stringMatch[1] ?? "").replace(/''/g, "'");

    // Check if jsonb cast or starts with { / [
    if (trimmed.includes("::jsonb") || trimmed.includes("::json")) {
      try {
        return JSON.parse(unescaped);
      } catch {
        return unescaped;
      }
    }

    // Check if array literal '{val1,val2}'
    if (unescaped.startsWith("{") && unescaped.endsWith("}")) {
      const inner = unescaped.slice(1, -1);
      if (!inner.trim()) return [];
      // Split array elements handling quotes
      const elements: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < inner.length; i++) {
        const char = inner[i];
        if (char === '"' && (i === 0 || inner[i - 1] !== "\\")) {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          elements.push(current.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"'));
          current = "";
        } else {
          current += char;
        }
      }
      if (current) {
        elements.push(current.trim().replace(/^"|"$/g, "").replace(/\\"/g, '"'));
      }
      return elements;
    }

    return unescaped;
  }

  return trimmed;
}

/**
 * Parses an entire SQL backup string into structured table data.
 */
export function parseSqlDump(sql: string): ParsedSqlTableData[] {
  const result: ParsedSqlTableData[] = [];
  const tableDataMap = new Map<string, { columns: string[]; rows: Record<string, unknown>[] }>();

  // Regular expression to match standard INSERT INTO statements
  // INSERT INTO "tableName" (col1, col2, ...) VALUES (...), (...);
  const insertRegex =
    /INSERT\s+INTO\s+["`]?([a-zA-Z0-9_]+)["`]?\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+?)(?:ON\s+CONFLICT[\s\S]+?)?;/gi;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const rawColumns = match[2];
    const rawValues = match[3];

    if (!tableName || !rawColumns || !rawValues) {
      continue;
    }

    const columns = rawColumns
      .split(",")
      .map((c) => c.trim().replace(/["`]/g, ""))
      .filter(Boolean);

    // Split value rows: (val1, val2), (val3, val4)
    const valueTuples: string[] = [];
    let currentTuple = "";
    let inParen = false;
    let inQuote = false;

    for (let i = 0; i < rawValues.length; i++) {
      const char = rawValues[i];

      if (char === "'" && (i === 0 || rawValues[i - 1] !== "\\")) {
        // Handle escaped quotes in SQL: ''
        if (inQuote && rawValues[i + 1] === "'") {
          currentTuple += "''";
          i++;
          continue;
        }
        inQuote = !inQuote;
        currentTuple += char;
      } else if (char === "(" && !inQuote) {
        inParen = true;
        currentTuple = "";
      } else if (char === ")" && !inQuote && inParen) {
        inParen = false;
        valueTuples.push(currentTuple.trim());
        currentTuple = "";
      } else if (inParen) {
        currentTuple += char;
      }
    }

    // Parse each tuple into a row object
    const rows: Record<string, unknown>[] = [];
    for (const tuple of valueTuples) {
      // Split tuple by comma ignoring quotes
      const values: string[] = [];
      let valBuffer = "";
      let quoteOpen = false;

      for (let j = 0; j < tuple.length; j++) {
        const ch = tuple[j];
        if (ch === "'" && (j === 0 || tuple[j - 1] !== "\\")) {
          if (quoteOpen && tuple[j + 1] === "'") {
            valBuffer += "''";
            j++;
            continue;
          }
          quoteOpen = !quoteOpen;
          valBuffer += ch;
        } else if (ch === "," && !quoteOpen) {
          values.push(valBuffer.trim());
          valBuffer = "";
        } else {
          valBuffer += ch;
        }
      }
      if (valBuffer.trim()) {
        values.push(valBuffer.trim());
      }

      const row: Record<string, unknown> = {};
      for (let k = 0; k < columns.length; k++) {
        const col = columns[k];
        if (col) {
          const rawVal = values[k];
          const val = rawVal !== undefined ? parseSqlLiteral(rawVal) : null;
          row[col] = val;
        }
      }
      rows.push(row);
    }

    if (!tableDataMap.has(tableName)) {
      tableDataMap.set(tableName, { columns, rows: [] });
    }
    const existing = tableDataMap.get(tableName);
    if (existing) {
      existing.rows.push(...rows);
    }
  }

  for (const [tableName, data] of tableDataMap.entries()) {
    result.push({
      tableName,
      columns: data.columns,
      rows: data.rows,
    });
  }

  return result;
}

/**
 * Imports structured SQL data into Supabase following dependency order.
 */
export async function importSqlDatabaseDump(sql: string): Promise<DatabaseImportResult> {
  const parsedTables = parseSqlDump(sql);
  const tableMap = new Map<string, ParsedSqlTableData>();
  for (const t of parsedTables) {
    tableMap.set(t.tableName, t);
  }

  const tableStats: Record<string, number> = {};
  const errors: string[] = [];
  let totalImported = 0;

  // Follow the safe dependency order
  for (const { table, pk } of DUMP_TABLES_ORDER) {
    const tableData = tableMap.get(table);
    if (!tableData || tableData.rows.length === 0) {
      tableStats[table] = 0;
      continue;
    }

    const rows = tableData.rows;
    const BATCH_SIZE = 50;
    let importedInTable = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      try {
        const { error } = await supabase
          .from(table as never)
          .upsert(batch as never, { onConflict: pk });

        if (error) {
          console.warn(`Error importing batch in ${table}:`, error.message);
          errors.push(`Table "${table}": ${error.message}`);
        } else {
          importedInTable += batch.length;
          totalImported += batch.length;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Table "${table}": ${msg}`);
      }
    }

    tableStats[table] = importedInTable;
  }

  return {
    success: errors.length === 0 || totalImported > 0,
    totalImported,
    tableStats,
    errors,
  };
}
