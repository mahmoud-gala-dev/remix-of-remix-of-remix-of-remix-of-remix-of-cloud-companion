import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, GitCompare, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({
    meta: [
      { title: "Compare Excel | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Compare two spreadsheets row by row entirely in your browser — no upload needed.",
      },
      { property: "og:title", content: "Compare Excel | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Compare two spreadsheets row by row entirely in your browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
  errorComponent: ({ error }: { error: Error }) => (
    <p className="p-6 text-sm text-destructive">Comparison failed: {error.message}</p>
  ),
  notFoundComponent: () => <p className="p-6 text-sm text-muted-foreground">Page not found.</p>,
});

type Sheet = { name: string; rows: string[][] };

const MAX_BYTES = 10 * 1024 * 1024;

async function readSheet(file: File): Promise<Sheet> {
  if (file.size > MAX_BYTES) throw new Error("File must be smaller than 10 MB");
  const buffer = await file.arrayBuffer();
  // Loaded on demand so the spreadsheet parser is not part of the initial bundle.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array" });
  const first = wb.SheetNames[0];
  const worksheet = first ? wb.Sheets[first] : undefined;
  if (!worksheet) throw new Error("The file has no sheets");
  const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  return { name: file.name, rows: rows.map((r) => r.map((c) => String(c ?? "").trim())) };
}

export type RowDiff = {
  index: number;
  kind: "added" | "removed" | "changed";
  left: string[];
  right: string[];
};

/** Pure row-by-row diff of two sheets — exported for tests. */
export function diffSheets(left: string[][], right: string[][]): RowDiff[] {
  const max = Math.max(left.length, right.length);
  const diffs: RowDiff[] = [];
  for (let i = 0; i < max; i++) {
    const a = left[i];
    const b = right[i];
    if (a && !b) diffs.push({ index: i, kind: "removed", left: a, right: [] });
    else if (!a && b) diffs.push({ index: i, kind: "added", left: [], right: b });
    else if (a && b && a.join("\u0000") !== b.join("\u0000"))
      diffs.push({ index: i, kind: "changed", left: a, right: b });
  }
  return diffs;
}

function FilePicker({
  label,
  sheet,
  onPick,
  onClear,
}: {
  label: string;
  sheet: Sheet | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>.xlsx, .xls or .csv up to 10 MB</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".xlsx,.xls,.csv"
          aria-label={`Choose file for ${label}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
        {sheet ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{sheet.name}</span>
              <Badge variant="outline">{sheet.rows.length} rows</Badge>
            </span>
            <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onClear}>
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" /> Choose file
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ComparePage() {
  const [left, setLeft] = useState<Sheet | null>(null);
  const [right, setRight] = useState<Sheet | null>(null);

  const pick = async (file: File, setter: (s: Sheet) => void) => {
    try {
      setter(await readSheet(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file");
    }
  };

  const diffs = useMemo(
    () => (left && right ? diffSheets(left.rows, right.rows) : []),
    [left, right],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compare Excel</h1>
        <p className="text-sm text-muted-foreground">
          Row-by-row diff of two spreadsheets. Files never leave your browser.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FilePicker
          label="Original file"
          sheet={left}
          onPick={(f) => pick(f, setLeft)}
          onClear={() => setLeft(null)}
        />
        <FilePicker
          label="Updated file"
          sheet={right}
          onPick={(f) => pick(f, setRight)}
          onClear={() => setRight(null)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-4 w-4" aria-hidden="true" /> Differences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!left || !right ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Choose two files to see the differences between them.
            </p>
          ) : diffs.length === 0 ? (
            <p className="py-10 text-center text-sm text-success">
              No differences — both sheets are identical.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead className="w-28">Change</TableHead>
                    <TableHead>Original</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.slice(0, 500).map((d) => (
                    <TableRow key={d.index}>
                      <TableCell className="font-mono text-xs">{d.index + 1}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.kind}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs">
                        {d.left.join(" | ")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs">
                        {d.right.join(" | ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {diffs.length > 500 && (
                <p className="pt-3 text-xs text-muted-foreground">
                  Showing the first 500 of {diffs.length} differences.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
