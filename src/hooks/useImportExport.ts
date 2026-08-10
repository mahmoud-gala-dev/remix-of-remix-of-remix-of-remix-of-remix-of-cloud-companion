import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, UserRole, UserStatus } from "@/types/user-management";

export interface FullDatabaseBackup {
  exportedAt: string;
  version: string;
  app: string;
  data: {
    profiles: Record<string, unknown>[];
    user_roles: Record<string, unknown>[];
    projects: Record<string, unknown>[];
    bugs: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    comments: Record<string, unknown>[];
    notifications: Record<string, unknown>[];
    bug_history: Record<string, unknown>[];
  };
}

export function useImportExport() {
  /** Helper to trigger file download in browser */
  const triggerDownload = useCallback((content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /** Export users to JSON format */
  const exportJSON = useCallback(
    (users: User[], filename = "users_export.json") => {
      try {
        const jsonString = JSON.stringify(users, null, 2);
        triggerDownload(jsonString, filename, "application/json");
      } catch (error) {
        throw new Error(
          `Failed to export JSON file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [triggerDownload],
  );

  /** Export users to CSV format */
  const exportCSV = useCallback(
    (users: User[], filename = "users_export.csv") => {
      try {
        const headers = ["id", "username", "email", "role", "status", "createdAt", "lastLogin"];
        const rows = users.map((u) => [
          u.id,
          `"${u.username.replace(/"/g, '""')}"`,
          `"${u.email.replace(/"/g, '""')}"`,
          u.role,
          u.status,
          u.createdAt,
          u.lastLogin || "",
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        triggerDownload(csvContent, filename, "text/csv;charset=utf-8;");
      } catch (error) {
        throw new Error(
          `Failed to export CSV file: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [triggerDownload],
  );

  /** Export full database (users, projects, bugs, tasks, comments, etc.) to JSON */
  const exportFullDatabaseJSON = useCallback(
    async (filename = `full_database_backup_${new Date().toISOString().slice(0, 10)}.json`) => {
      try {
        const [
          profilesRes,
          rolesRes,
          projectsRes,
          bugsRes,
          tasksRes,
          commentsRes,
          notificationsRes,
          historyRes,
        ] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("user_roles").select("*"),
          supabase.from("projects").select("*"),
          supabase.from("bugs").select("*"),
          supabase.from("tasks").select("*"),
          supabase.from("comments").select("*"),
          supabase.from("notifications").select("*"),
          supabase.from("bug_history").select("*"),
        ]);

        const backupPayload: FullDatabaseBackup = {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          app: "ElectroPI Bug Tracker",
          data: {
            profiles: (profilesRes.data as Record<string, unknown>[]) || [],
            user_roles: (rolesRes.data as Record<string, unknown>[]) || [],
            projects: (projectsRes.data as Record<string, unknown>[]) || [],
            bugs: (bugsRes.data as Record<string, unknown>[]) || [],
            tasks: (tasksRes.data as Record<string, unknown>[]) || [],
            comments: (commentsRes.data as Record<string, unknown>[]) || [],
            notifications: (notificationsRes.data as Record<string, unknown>[]) || [],
            bug_history: (historyRes.data as Record<string, unknown>[]) || [],
          },
        };

        const jsonString = JSON.stringify(backupPayload, null, 2);
        triggerDownload(jsonString, filename, "application/json");
        return backupPayload;
      } catch (error) {
        throw new Error(
          `Failed to export full database: ${error instanceof Error ? error.message : "Database fetch failed"}`,
        );
      }
    },
    [triggerDownload],
  );

  /** Export full database tables into consolidated CSV bundle */
  const exportFullDatabaseCSV = useCallback(
    async (filename = `full_database_backup_${new Date().toISOString().slice(0, 10)}.csv`) => {
      try {
        const [profilesRes, projectsRes, bugsRes, tasksRes] = await Promise.all([
          supabase.from("profiles").select("*"),
          supabase.from("projects").select("*"),
          supabase.from("bugs").select("*"),
          supabase.from("tasks").select("*"),
        ]);

        let csvString = "=== TABLE: PROFILES ===\n";
        const profiles = profilesRes.data || [];
        if (profiles.length) {
          csvString += Object.keys(profiles[0]!).join(",") + "\n";
          csvString += profiles
            .map((p) =>
              Object.values(p)
                .map((v) => `"${v}"`)
                .join(","),
            )
            .join("\n");
        }

        csvString += "\n\n=== TABLE: PROJECTS ===\n";
        const projects = projectsRes.data || [];
        if (projects.length) {
          csvString += Object.keys(projects[0]!).join(",") + "\n";
          csvString += projects
            .map((p) =>
              Object.values(p)
                .map((v) => `"${v}"`)
                .join(","),
            )
            .join("\n");
        }

        csvString += "\n\n=== TABLE: BUGS ===\n";
        const bugs = bugsRes.data || [];
        if (bugs.length) {
          csvString += Object.keys(bugs[0]!).join(",") + "\n";
          csvString += bugs
            .map((b) =>
              Object.values(b)
                .map((v) => `"${v}"`)
                .join(","),
            )
            .join("\n");
        }

        csvString += "\n\n=== TABLE: TASKS ===\n";
        const tasks = tasksRes.data || [];
        if (tasks.length) {
          csvString += Object.keys(tasks[0]!).join(",") + "\n";
          csvString += tasks
            .map((t) =>
              Object.values(t)
                .map((v) => `"${v}"`)
                .join(","),
            )
            .join("\n");
        }

        triggerDownload(csvString, filename, "text/csv;charset=utf-8;");
      } catch (error) {
        throw new Error(
          `Failed to export full database CSV: ${error instanceof Error ? error.message : "Export failed"}`,
        );
      }
    },
    [triggerDownload],
  );

  /** Parse JSON file */
  const parseJSONFile = useCallback((file: File): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          resolve(parsed);
        } catch (err) {
          reject(
            new Error(
              `Failed to parse JSON file: ${err instanceof Error ? err.message : "Invalid file structure"}`,
            ),
          );
        }
      };
      reader.onerror = () => reject(new Error("An error occurred while reading the file."));
      reader.readAsText(file);
    });
  }, []);

  /** Parse CSV file */
  const parseCSVFile = useCallback((file: File): Promise<User[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
          if (lines.length < 2) {
            throw new Error("CSV file is empty or missing data rows.");
          }

          const headers = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
          const users: User[] = [];

          for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i]!;
            const values = currentLine.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));

            const rowData: Record<string, string> = {};
            headers.forEach((header, index) => {
              rowData[header] = values[index] || "";
            });

            if (rowData["username"] && rowData["email"]) {
              users.push({
                id: rowData["id"] || `usr-imp-${Date.now()}-${i}`,
                username: rowData["username"],
                email: rowData["email"],
                role: (rowData["role"] as UserRole) || "tester",
                status: (rowData["status"] as UserStatus) || "active",
                createdAt: rowData["createdAt"] || new Date().toISOString(),
                lastLogin: rowData["lastLogin"] || undefined,
              });
            }
          }

          resolve(users);
        } catch (err) {
          reject(
            new Error(
              `Failed to parse CSV file: ${err instanceof Error ? err.message : "Invalid format"}`,
            ),
          );
        }
      };
      reader.onerror = () => reject(new Error("An error occurred while reading the file."));
      reader.readAsText(file);
    });
  }, []);

  return {
    exportJSON,
    exportCSV,
    exportFullDatabaseJSON,
    exportFullDatabaseCSV,
    parseJSONFile,
    parseCSVFile,
  };
}
