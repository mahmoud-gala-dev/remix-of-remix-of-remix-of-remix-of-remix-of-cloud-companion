import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  FileDown,
  FolderKanban,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import { downloadBugImportTemplate } from "@/lib/bug-excel";
import { importBugsFromExcel } from "@/lib/bug-excel-import";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchProfiles,
  statusTone,
  priorityTone,
  type Bug,
  type Project,
  type Task,
} from "@/lib/api";
import { ProjectMembers } from "@/components/projects/ProjectMembers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPagination } from "@/components/dashboard/DashboardPagination";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project Detail | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "View project details, bug status breakdown and related tasks.",
      },
      { property: "og:title", content: "Project Detail | ElectroPI Bug Tracker" },
      { property: "og:description", content: "Deep dive into a single project's bugs and tasks." },
    ],
  }),
  component: ProjectDetailPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="project" />,
});

const STATUS_COLORS: Record<string, string> = {
  Open: "var(--chart-1)",
  "In Progress": "var(--chart-2)",
  Fixed: "var(--chart-3)",
  Reopened: "var(--chart-4)",
  Closed: "var(--chart-5)",
};
const STATUS_OPTIONS = ["Active", "Paused", "Archived"];

async function fetchProject(id: number): Promise<Project | null> {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function fetchProjectBugs(id: number): Promise<Bug[]> {
  const { data, error } = await supabase
    .from("bugs")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
async function fetchProjectTasks(id: number): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const projectId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
  });
  const { data: bugs, isLoading: bugsLoading } = useQuery({
    queryKey: ["project-bugs", projectId],
    queryFn: () => fetchProjectBugs(projectId),
  });
  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: () => fetchProjectTasks(projectId),
  });
  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [tasksPage, setTasksPage] = useState(1);
  const TASKS_PAGE_SIZE = 5;
  const projectTasks = tasks ?? [];
  const paginatedTasks = projectTasks.slice(
    (tasksPage - 1) * TASKS_PAGE_SIZE,
    tasksPage * TASKS_PAGE_SIZE,
  );

  const [bugsPage, setBugsPage] = useState(1);
  const BUGS_PAGE_SIZE = 5;
  const projectBugs = bugs ?? [];
  const paginatedBugs = projectBugs.slice(
    (bugsPage - 1) * BUGS_PAGE_SIZE,
    bugsPage * BUGS_PAGE_SIZE,
  );

  const importMutation = useMutation({
    mutationFn: (file: File) =>
      importBugsFromExcel({ file, projectId, uploadedById: user?.id ?? null }),
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.imported} bug(s) · ${result.duplicates} duplicate(s) · ${result.failures.length} failed`,
      );

      queryClient.invalidateQueries({ queryKey: ["bugs"] });
      queryClient.invalidateQueries({ queryKey: ["project-bugs", projectId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [values, setValues] = useState({ name: "", key: "", description: "", status: "Active" });

  const canManage = user && project && (user.role === "admin" || user.id === project.created_by);

  const openEdit = () => {
    if (!project) return;
    setValues({
      name: project.name,
      key: project.key,
      description: project.description ?? "",
      status: project.status ?? "Active",
    });
    setEditOpen(true);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          name: values.name.trim(),
          key: values.key.trim().toUpperCase(),
          description: values.description.trim() || null,
          status: values.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
      toast.success("Project updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const usernameOf = (userId: string | null) => {
    if (!userId) return "Unassigned";
    return (profiles ?? []).find((p) => p.id === userId)?.username ?? "Unknown";
  };

  if (isLoading) return <DetailSkeleton />;
  if (!project) return <RouteNotFound label="project" />;

  const statusCounts = (bugs ?? []).reduce<Record<string, number>>((acc, bug) => {
    acc[bug.status] = (acc[bug.status] ?? 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{project.key}</span>
              <Badge variant="outline">{project.status ?? "Active"}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="me-2 h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="me-2 h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      {project.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Bug Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No bugs to display.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        strokeWidth={2}
                      >
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name] ?? "var(--muted)"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 text-sm">
                  {chartData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: STATUS_COLORS[entry.name] ?? "var(--muted)",
                        }}
                      />
                      <span className="font-medium">{entry.name}:</span>
                      <span className="text-muted-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Tasks ({projectTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tasks linked to this project.
              </p>
            ) : (
              <div className="space-y-2">
                {paginatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm"
                  >
                    <span className="truncate">{task.title}</span>
                    <Badge variant="outline" className={statusTone(task.status)}>
                      {task.status}
                    </Badge>
                  </div>
                ))}
                <DashboardPagination
                  page={tasksPage}
                  totalItems={projectTasks.length}
                  pageSize={TASKS_PAGE_SIZE}
                  onPageChange={setTasksPage}
                  itemLabel="tasks"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectMembers projectId={projectId} profiles={profiles ?? []} canManage={!!canManage} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Bugs ({projectBugs.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadBugImportTemplate()}
            >
              <FileDown className="me-2 h-4 w-4" aria-hidden="true" />
              Template
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) importMutation.mutate(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={importMutation.isPending}
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="me-2 h-4 w-4" aria-hidden="true" />
              {importMutation.isPending ? "Importing…" : "Import Excel"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {bugsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : projectBugs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No bugs reported for this project.
            </p>
          ) : (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Reported by</TableHead>
                    <TableHead>Assigned to</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBugs.map((bug) => (
                    <TableRow
                      key={bug.id}
                      className="cursor-pointer"
                      onClick={() => navigate({ to: "/bugs/$id", params: { id: String(bug.id) } })}
                    >
                      <TableCell className="font-mono text-xs font-semibold">{bug.bug_id}</TableCell>
                      <TableCell className="max-w-xs truncate font-medium">{bug.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(bug.status)}>
                          {bug.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityTone(bug.priority)}>
                          {bug.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{usernameOf(bug.reported_by)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{usernameOf(bug.assigned_to)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <DashboardPagination
                page={bugsPage}
                totalItems={projectBugs.length}
                pageSize={BUGS_PAGE_SIZE}
                onPageChange={setBugsPage}
                itemLabel="bugs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>Update the project's details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Key</label>
              <Input
                value={values.key}
                onChange={(e) => setValues((v) => ({ ...v, key: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={values.status}
                onValueChange={(status) => setValues((v) => ({ ...v, status }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the project permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
