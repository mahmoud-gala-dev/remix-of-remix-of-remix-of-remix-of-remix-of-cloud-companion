export type CsvValue = string | number | boolean | null | undefined | Date;

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => CsvValue;
};

export function csvCell(value: CsvValue) {
  if (value == null) return "";
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => csvCell(column.header)).join(",");
  const body = rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function datedCsvFilename(prefix: string, now = new Date()) {
  return `${prefix}-${now.toISOString().slice(0, 10)}.csv`;
}
