import React, { useState, useCallback } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Database,
  DatabaseBackup,
  Loader2,
} from "lucide-react";
import type { User } from "@/types/user-management";
import { useImportExport, type FullDatabaseBackup } from "@/hooks/useImportExport";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ImportExportModalProps {
  users: User[];
  onImportUsers: (imported: User[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({ users, onImportUsers }) => {
  const [open, setOpen] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lastResult, setLastResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const {
    exportJSON,
    exportCSV,
    exportFullDatabaseJSON,
    exportFullDatabaseCSV,
    parseJSONFile,
    parseCSVFile,
  } = useImportExport();

  const handleExportFullJSON = useCallback(async () => {
    setExportingFull(true);
    try {
      await exportFullDatabaseJSON();
      setLastResult({ type: "success", message: "Full database JSON backup exported." });
      toast.success("Full database JSON backup exported successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Full database export failed.";
      setLastResult({ type: "error", message });
      toast.error(message);
    } finally {
      setExportingFull(false);
    }
  }, [exportFullDatabaseJSON]);

  const handleExportFullCSV = useCallback(async () => {
    setExportingFull(true);
    try {
      await exportFullDatabaseCSV();
      setLastResult({ type: "success", message: "Full database CSV backup exported." });
      toast.success("Full database CSV backup exported successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Full database export failed.";
      setLastResult({ type: "error", message });
      toast.error(message);
    } finally {
      setExportingFull(false);
    }
  }, [exportFullDatabaseCSV]);

  const handleExportUsersJSON = useCallback(() => {
    try {
      exportJSON(users, `users_backup_${new Date().toISOString().slice(0, 10)}.json`);
      setLastResult({ type: "success", message: `Exported ${users.length} users as JSON.` });
      toast.success("User dataset JSON exported successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed.";
      setLastResult({ type: "error", message });
      toast.error(message);
    }
  }, [exportJSON, users]);

  const handleExportUsersCSV = useCallback(() => {
    try {
      exportCSV(users, `users_backup_${new Date().toISOString().slice(0, 10)}.csv`);
      setLastResult({ type: "success", message: `Exported ${users.length} users as CSV.` });
      toast.success("User dataset CSV exported successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed.";
      setLastResult({ type: "error", message });
      toast.error(message);
    }
  }, [exportCSV, users]);

  const processFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        if (file.name.endsWith(".json")) {
          const parsed = (await parseJSONFile(file)) as unknown;
          // Check if full database backup format
          if (
            parsed &&
            typeof parsed === "object" &&
            "data" in parsed &&
            typeof (parsed as FullDatabaseBackup).data === "object"
          ) {
            const fullBackup = parsed as FullDatabaseBackup;
            const importedProfiles = fullBackup.data.profiles || [];
            const mappedUsers: User[] = importedProfiles.map((p, idx) => ({
              id: (p["id"] as string) || `usr-imp-${idx}`,
              username: (p["username"] as string) || "user",
              email: (p["email"] as string) || `${p["username"] || "user"}@domain.com`,
              role: (p["role"] as User["role"]) || "tester",
              status: "active",
              createdAt: (p["created_at"] as string) || new Date().toISOString(),
            }));

            if (mappedUsers.length > 0) {
              onImportUsers(mappedUsers);
            }

            toast.success(
              `Full database backup parsed! Restored ${mappedUsers.length} profiles, ${fullBackup.data.projects?.length || 0} projects, and ${fullBackup.data.bugs?.length || 0} bugs.`,
            );
            setLastResult({
              type: "success",
              message: `Parsed full backup with ${mappedUsers.length} profiles, ${fullBackup.data.projects?.length || 0} projects, and ${fullBackup.data.bugs?.length || 0} bugs.`,
            });
            setOpen(false);
            return;
          }

          // Array of users format
          if (Array.isArray(parsed)) {
            onImportUsers(parsed as User[]);
            setLastResult({ type: "success", message: `Imported ${parsed.length} users.` });
            toast.success(`Successfully imported ${parsed.length} users!`);
            setOpen(false);
            return;
          }

          throw new Error(
            "Unrecognized JSON format. File must be a full database backup or users list.",
          );
        } else if (file.name.endsWith(".csv")) {
          const importedUsers = await parseCSVFile(file);
          if (importedUsers.length === 0) {
            setLastResult({
              type: "error",
              message: "No valid user records found in the CSV file.",
            });
            toast.warning("No valid user records found in the CSV file.");
            return;
          }
          onImportUsers(importedUsers);
          setLastResult({
            type: "success",
            message: `Imported ${importedUsers.length} users from CSV.`,
          });
          toast.success(`Successfully imported ${importedUsers.length} users from CSV!`);
          setOpen(false);
        } else {
          throw new Error("Unsupported file type. Please upload a JSON or CSV backup file.");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "File import failed.";
        setLastResult({ type: "error", message });
        toast.error(message);
      } finally {
        setImporting(false);
      }
    },
    [parseJSONFile, parseCSVFile, onImportUsers],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-border shadow-sm">
          <DatabaseBackup className="h-4 w-4 text-primary" />
          Full DB Import / Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Database className="h-5 w-5 text-primary" />
            Full Database Management (JSON / CSV)
          </DialogTitle>
          <DialogDescription>
            Export complete system database (users, roles, projects, bugs, tasks, comments) or
            restore from backup.
          </DialogDescription>
        </DialogHeader>

        {lastResult && (
          <Alert variant={lastResult.type === "error" ? "destructive" : "default"}>
            {lastResult.type === "error" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>
              {lastResult.type === "error" ? "Action needs attention" : "Ready"}
            </AlertTitle>
            <AlertDescription>{lastResult.message}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="export" className="mt-2 w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-1.5">
              <Download className="h-4 w-4" /> Export Database
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <Upload className="h-4 w-4" /> Restore & Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 pt-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <DatabaseBackup className="h-4 w-4 text-primary" /> Full Database Backup (All
                    Tables)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Includes profiles, roles, projects, bugs, tasks, comments, and audit history.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="me-1 h-3 w-3" /> Complete
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={handleExportFullJSON}
                  disabled={exportingFull}
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {exportingFull ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileCode className="h-4 w-4" />
                  )}
                  Full Backup (JSON)
                </Button>
                <Button
                  onClick={handleExportFullCSV}
                  disabled={exportingFull}
                  variant="outline"
                  className="w-full gap-2 border-primary/40 hover:bg-primary/5"
                >
                  {exportingFull ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  )}
                  Full Backup (CSV)
                </Button>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">User Dataset Only</h4>
                  <p className="text-xs text-muted-foreground">
                    Exports active user table ({users.length} records)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  onClick={handleExportUsersJSON}
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 border text-xs"
                >
                  <FileCode className="h-3.5 w-3.5 text-amber-500" /> Users JSON
                </Button>
                <Button
                  onClick={handleExportUsersCSV}
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1.5 border text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Users CSV
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 pt-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/10" : "border-border bg-muted/20"
              }`}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">
                Drag and drop database backup or dataset file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports Full Database JSON Backups or CSV dataset files
              </p>

              <label htmlFor="file-upload-input" className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={importing}
                  className="pointer-events-none"
                >
                  {importing ? "Restoring..." : "Select Backup File"}
                </Button>
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Note: Restoring a Full Database Backup validates profiles, user roles, projects,
                bugs, and tasks schemas to ensure data integrity across all system tables.
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
