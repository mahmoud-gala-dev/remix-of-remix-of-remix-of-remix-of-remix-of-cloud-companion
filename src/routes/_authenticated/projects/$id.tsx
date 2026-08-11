import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ClipboardList, FolderKanban, Pencil, Trash2 } from "lucide-react";
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
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
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
      toast.success("Project deleted");
      navigate({ to: "/projects" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const usernameOf = (uid: string | null) =>
    (profiles ?? []).find((p) => p.id === uid)?.username ?? "—";

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const bug of bugs ?? []) map.set(bug.status, (map.get(bug.status) ?? 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bugs]);

  if (isLoading) return <DetailSkeleton />;
  if (!project) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-muted-foreground">
        Project not found.
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/projects">Back to Projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link to="/projects">
          <ArrowLeft className="me-2 h-4 w-4" />
          Back to Projects
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <FolderKanban className="h-4 w-4" />
                {project.key}
              </div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {project.description || "No description provided."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{project.status}</Badge>
              {canManage && (
                <>
                  <Button variant="outline" size="sm" onClick={openEdit}>
                    <Pencil className="me-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="me-2 h-4 w-4 text-destructive" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bug Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name] ?? "var(--primary)"} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No bugs yet for this project.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Tasks ({tasks?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(tasks ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No tasks linked to this project.
              </p>
            ) : (
              (tasks ?? []).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                >
                  <span className="truncate">{task.title}</span>
                  <Badge variant="outline" className={statusTone(task.status)}>
                    {task.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <ProjectMembers projectId={projectId} profiles={profiles ?? []} canManage={!!canManage} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bugs ({bugs?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {bugsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (bugs ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No bugs reported for this project.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned to</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(bugs ?? []).map((bug) => (
                  <TableRow
                    key={bug.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/bugs/$id", params: { id: String(bug.id) } })}
                  >
                    <TableCell className="font-mono text-xs">{bug.bug_id}</TableCell>
                    <TableCell className="max-w-xs truncate">{bug.title}</TableCell>
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
                    <TableCell>{usernameOf(bug.assigned_to)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
