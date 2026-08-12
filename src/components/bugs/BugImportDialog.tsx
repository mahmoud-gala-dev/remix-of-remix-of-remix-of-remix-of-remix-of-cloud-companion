import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ImportFailure = {
  excelRowNumber: number;
  bugId: string;
  reason: string;
  existingBugId?: number;
};

export type ImportReport = {
  filename: string;
  imported: number;
  failures: ImportFailure[];
  skippedEmpty: number;
  duplicates: number;
};

/** Live progress bar shown while an Excel import is running. */
export function BugImportProgress({
  progress,
  t,
}: {
  progress: { current: number; total: number } | null;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const pct =
    progress && progress.total > 0
      ? `${Math.round((progress.current / progress.total) * 100)}%`
      : "10%";
  return (
    <div
      className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-medium">
        {progress
          ? t("bugs.import.progress", { current: progress.current, total: progress.total })
          : t("bugs.importing")}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: pct }} />
      </div>
    </div>
  );
}

/** Post-import report listing skipped, duplicated and failed spreadsheet rows. */
export function BugImportDialog({
  report,
  onClose,
  t,
}: {
  report: ImportReport | null;
  onClose: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  return (
    <Dialog open={Boolean(report)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("bugs.import.reportTitle")}</DialogTitle>
          <DialogDescription>
            {report?.filename} ·{" "}
            {t("bugs.import.reportDescription", {
              imported: report?.imported ?? 0,
              failed: report?.failures.length ?? 0,
            })}
          </DialogDescription>
        </DialogHeader>
        {report && (report.skippedEmpty > 0 || report.duplicates > 0) ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {report.skippedEmpty > 0 && (
              <li>{t("bugs.import.skippedEmpty", { count: report.skippedEmpty })}</li>
            )}
            {report.duplicates > 0 && (
              <li>{t("bugs.import.duplicateToast", { count: report.duplicates })}</li>
            )}
          </ul>
        ) : null}
        {report?.failures.length ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">{t("bugs.import.failedRows")}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("bugs.import.row")}</TableHead>
                  <TableHead>{t("bugs.import.bugId")}</TableHead>
                  <TableHead>{t("bugs.import.reason")}</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.failures.map((failure) => (
                  <TableRow key={`${failure.excelRowNumber}-${failure.bugId}`}>
                    <TableCell>{failure.excelRowNumber}</TableCell>
                    <TableCell className="font-mono text-xs">{failure.bugId || "—"}</TableCell>
                    <TableCell className="text-destructive">{failure.reason}</TableCell>
                    <TableCell>
                      {failure.existingBugId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link to="/bugs/$id" params={{ id: String(failure.existingBugId) }}>
                            {t("bugs.import.open")}
                          </Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-success">{t("bugs.import.noFailures")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
