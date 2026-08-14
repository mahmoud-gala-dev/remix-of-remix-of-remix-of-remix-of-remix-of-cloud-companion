import React, { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  Upload,
  Copy,
  Check,
  FileCode,
  AlertTriangle,
  RefreshCw,
  FolderKanban,
  Bug,
  ClipboardList,
  Users,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  downloadDatabaseSqlBackup,
  generateFullDatabaseSql,
  fetchDatabaseTableStats,
} from "@/lib/database-sql-dump";
import { importSqlDatabaseDump, parseSqlDump, type ParsedSqlTableData } from "@/lib/database-sql-import";
import { useI18n } from "@/lib/i18n";

export function DatabaseSqlBackupPanel() {
  const queryClient = useQueryClient();
  const { language } = useI18n();
  const isArabic = language === "ar";

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // SQL Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSql, setPreviewSql] = useState("");
  const [previewTotalRecords, setPreviewTotalRecords] = useState(0);

  // Import Confirmation State
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [parsedImportData, setParsedImportData] = useState<ParsedSqlTableData[]>([]);
  const [pendingSqlText, setPendingSqlText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Table Stats Query
  const {
    data: tableStats = {},
    isLoading: isStatsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["admin-database-table-stats"],
    queryFn: fetchDatabaseTableStats,
  });

  const invalidateAllData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bugs"] });
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project"] });
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-database-table-stats"] });
  }, [queryClient]);

  // Handle Export File Download
  const handleExportDownload = async () => {
    setIsExporting(true);
    try {
      const stats = await downloadDatabaseSqlBackup();
      toast.success(
        isArabic
          ? `تم تصدير قاعدة البيانات بنجاح (${stats.totalRecords} سجل)`
          : `Database exported successfully (${stats.totalRecords} records)`,
        {
          description: isArabic
            ? "تم تنزيل ملف النسخة الاحتياطية بصيغة SQL"
            : "SQL backup file has been saved to your downloads.",
        },
      );
    } catch (err) {
      toast.error(
        isArabic ? "فشل تصدير قاعدة البيانات" : "Failed to export database",
        {
          description: err instanceof Error ? err.message : String(err),
        },
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Export Preview Generation
  const handleOpenPreview = async () => {
    setIsExporting(true);
    try {
      const result = await generateFullDatabaseSql();
      setPreviewSql(result.sql);
      setPreviewTotalRecords(result.stats.totalRecords);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(
        isArabic ? "فشل توليد كود SQL" : "Failed to generate SQL preview",
        {
          description: err instanceof Error ? err.message : String(err),
        },
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySql = () => {
    void navigator.clipboard.writeText(previewSql);
    setCopied(true);
    toast.success(isArabic ? "تم نسخ كود SQL إلى الحافظة" : "SQL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle File Selection for Import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.endsWith(".sql") && !file.name.endsWith(".txt")) {
      toast.error(
        isArabic
          ? "نوع الملف غير صالح، يرجى اختيار ملف بامتداد .sql"
          : "Invalid file type. Please select a .sql file.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast.error(isArabic ? "الملف المختار فارغ" : "Selected file is empty");
        return;
      }

      try {
        const parsed = parseSqlDump(text);
        if (parsed.length === 0) {
          toast.error(
            isArabic
              ? "لم يتم العثور على أوامر إدراج صالحة (INSERT INTO) داخل الملف"
              : "No valid INSERT statements found in the SQL file.",
          );
          return;
        }

        setPendingSqlText(text);
        setParsedImportData(parsed);
        setImportConfirmOpen(true);
      } catch (err) {
        toast.error(
          isArabic ? "فشل تحليل ملف SQL" : "Failed to parse SQL file",
          {
            description: err instanceof Error ? err.message : String(err),
          },
        );
      }
    };
    reader.readAsText(file);
  };

  // Execute Import
  const handleExecuteImport = async () => {
    setIsImporting(true);
    setImportConfirmOpen(false);
    try {
      const result = await importSqlDatabaseDump(pendingSqlText);
      invalidateAllData();

      if (result.success) {
        toast.success(
          isArabic
            ? `تم استيراد وتحديث قاعدة البيانات بنجاح (${result.totalImported} سجل)`
            : `Database imported successfully (${result.totalImported} records restored/updated)`,
          {
            description: isArabic
              ? "تم تحديث كافة الجداول والمشاريع والأخطاء والمهام"
              : "All projects, bugs, tasks, and system records were updated.",
          },
        );
      } else {
        toast.warning(
          isArabic
            ? "تم الاستيراد جزئياً مع بعض الأخطاء"
            : "Import completed with warnings or errors",
          {
            description: result.errors[0] ?? "Check SQL compatibility.",
          },
        );
      }
    } catch (err) {
      toast.error(
        isArabic ? "فشل استيراد قاعدة البيانات" : "Failed to import database",
        {
          description: err instanceof Error ? err.message : String(err),
        },
      );
    } finally {
      setIsImporting(false);
      setPendingSqlText("");
      setParsedImportData([]);
    }
  };

  const totalCalculatedRecords = Object.values(tableStats).reduce((a, b) => a + b, 0);
  const totalImportCandidateRows = parsedImportData.reduce((acc, t) => acc + t.rows.length, 0);

  return (
    <Card className="border-border/80 shadow-md">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <Database className="h-5 w-5 text-primary" />
              {isArabic ? "تصدير واستيراد قاعدة البيانات (SQL)" : "Full Database SQL Backup & Restore"}
            </CardTitle>
            <CardDescription className="mt-1">
              {isArabic
                ? "تصدير أو استيراد كامل بيانات النظام والمشاريع والأخطاء والمهام والموديولات بصيغة PostgreSQL SQL."
                : "Export or restore all project tables, bugs, modules, tasks, and settings as complete PostgreSQL SQL."}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchStats()}
            disabled={isStatsLoading}
            className="h-8 px-2.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`me-1.5 h-3.5 w-3.5 ${isStatsLoading ? "animate-spin" : ""}`} />
            {isArabic ? "تحديث الإحصائيات" : "Refresh Stats"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Table summary badges */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>{isArabic ? "إحصائيات الجداول الحالية" : "Live Database Records"}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {totalCalculatedRecords} {isArabic ? "سجل إجمالي" : "Total Records"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <FolderKanban className="h-3.5 w-3.5 text-info" />
              <span className="text-muted-foreground">{isArabic ? "المشاريع" : "Projects"}:</span>
              <strong className="font-mono">{tableStats["projects"] ?? 0}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <Bug className="h-3.5 w-3.5 text-destructive" />
              <span className="text-muted-foreground">{isArabic ? "الأخطاء" : "Bugs"}:</span>
              <strong className="font-mono">{tableStats["bugs"] ?? 0}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <ClipboardList className="h-3.5 w-3.5 text-warning" />
              <span className="text-muted-foreground">{isArabic ? "المهام" : "Tasks"}:</span>
              <strong className="font-mono">{tableStats["tasks"] ?? 0}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">{isArabic ? "المستخدمين" : "Profiles"}:</span>
              <strong className="font-mono">{tableStats["profiles"] ?? 0}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5 text-success" />
              <span className="text-muted-foreground">{isArabic ? "التعليقات" : "Comments"}:</span>
              <strong className="font-mono">{tableStats["comments"] ?? 0}</strong>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">{isArabic ? "الملاحظات والتحسينات" : "Notes & Improvements"}:</span>
              <strong className="font-mono">
                {(tableStats["bug_dev_notes"] ?? 0) + (tableStats["improvements"] ?? 0)}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Blocks */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Export Box */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {isArabic ? "تصدير قاعدة البيانات (SQL Dump)" : "Export Database (SQL Dump)"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isArabic
                  ? "توليد وتنزيل ملف SQL كامل يحتوي على كافة السجلات مع أوامر الإدراج والتحديث الآمنة."
                  : "Generate and download a complete SQL file with standard PostgreSQL INSERT / UPSERT statements."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                onClick={handleExportDownload}
                disabled={isExporting}
                size="sm"
                className="flex-1"
              >
                <Download className="me-2 h-4 w-4" />
                {isExporting
                  ? isArabic
                    ? "جاري التصدير…"
                    : "Exporting…"
                  : isArabic
                    ? "تنزيل ملف SQL"
                    : "Download SQL"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPreview}
                disabled={isExporting}
              >
                <FileCode className="me-1.5 h-4 w-4" />
                {isArabic ? "معاينة / نسخ" : "Preview / Copy"}
              </Button>
            </div>
          </div>

          {/* Import Box */}
          <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-4 shadow-sm space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">
                  {isArabic ? "استيراد واستعادة البيانات (SQL Restore)" : "Restore Database (SQL Import)"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isArabic
                  ? "رفع ملف SQL لاستعادة البيانات وتحديث المشاريع والأخطاء والمهام بشكل تراكمي وآمن."
                  : "Upload a previously exported SQL backup file to restore records directly into Supabase tables."}
              </p>
            </div>

            <div className="pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".sql,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-primary/50 hover:border-primary hover:bg-primary/5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <Upload className="me-2 h-4 w-4 text-primary" />
                {isImporting
                  ? isArabic
                    ? "جاري الاستيراد والتحديث…"
                    : "Restoring Database…"
                  : isArabic
                    ? "اختيار ملف SQL للاستيراد"
                    : "Select .SQL File to Restore"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* SQL Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              {isArabic ? "معاينة كود النسخة الاحتياطية SQL" : "Database SQL Backup Preview"}
            </DialogTitle>
            <DialogDescription>
              {isArabic
                ? `تم توليد كود SQL متكامل يشمل ${previewTotalRecords} سجل. يمكنك نسخه لتشغيله في Supabase SQL Editor أو حفظه كملف.`
                : `Generated PostgreSQL SQL dump containing ${previewTotalRecords} records. You can copy or execute it directly.`}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 rounded-xl border border-border/80 bg-muted/40 p-4 font-mono text-xs max-h-[50vh]">
            <pre className="whitespace-pre-wrap select-all">{previewSql}</pre>
          </ScrollArea>

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2 sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              {isArabic ? "إغلاق" : "Close"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleCopySql}>
                {copied ? <Check className="me-1.5 h-4 w-4 text-success" /> : <Copy className="me-1.5 h-4 w-4" />}
                {copied ? (isArabic ? "تم النسخ!" : "Copied!") : isArabic ? "نسخ كود SQL" : "Copy SQL"}
              </Button>
              <Button size="sm" onClick={handleExportDownload}>
                <Download className="me-1.5 h-4 w-4" />
                {isArabic ? "تنزيل كملف .sql" : "Download .sql"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Import Confirmation Alert */}
      <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {isArabic ? "تأكيد استيراد قاعدة البيانات" : "Confirm Database Restore"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-start">
              <p>
                {isArabic
                  ? `تم العثور على ${totalImportCandidateRows} سجل عبر ${parsedImportData.length} جدول في ملف الـ SQL.`
                  : `Detected ${totalImportCandidateRows} records across ${parsedImportData.length} tables in the selected SQL file.`}
              </p>

              <div className="rounded-lg border border-border bg-muted/40 p-2.5 max-h-40 overflow-y-auto space-y-1 font-mono text-xs">
                {parsedImportData.map((t) => (
                  <div key={t.tableName} className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-foreground">{t.tableName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t.rows.length} {isArabic ? "سجل" : "rows"}
                    </Badge>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                {isArabic
                  ? "سيتم إدراج هذه السجلات وتحديث السجلات المتطابقة تلقائياً دون حذف السجلات الأخرى غير الموجودة في الملف."
                  : "Records will be safely upserted into your database tables. Existing matching records will be updated."}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>
              {isArabic ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteImport}
              disabled={isImporting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isImporting
                ? isArabic
                  ? "جاري الاستيراد…"
                  : "Importing…"
                : isArabic
                  ? "بدء الاستيراد الآن"
                  : "Start Restore Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default DatabaseSqlBackupPanel;
