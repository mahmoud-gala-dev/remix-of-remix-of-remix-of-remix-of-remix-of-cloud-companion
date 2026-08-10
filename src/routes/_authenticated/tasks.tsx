import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { canCreateTasks } from "@/lib/permissions";
import {
  fetchProfiles,
  fetchUserRoleMap,
  fetchProjects,
  TASK_STATUSES,
  priorityTone,
  statusTone,
  type Task,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskTimer } from "@/components/tasks/TaskTimer";
import { InteractiveStatusEditor } from "@/components/common/InteractiveStatusEditor";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Track and prioritize team tasks, statuses, and importance flags.",
      },
      { property: "og:title", content: "Tasks | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Create, filter, and manage priority tasks across projects.",
      },
    ],
  }),
  component: TasksPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const PRIORITY_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export function getLocalMockTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("electropi.mock.tasks");
    if (raw) return JSON.parse(raw);
  } catch {
    return [];
  }
  return [];
}

async function fetchTasks(): Promise<Task[]> {
  const localMocks = getLocalMockTasks();
  try {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return localMocks;
    const dbTasks = data ?? [];
    const existingIds = new Set(dbTasks.map((t) => t.id));
    const uniqueMocks = localMocks.filter((t) => !existingIds.has(t.id));
    return [...dbTasks, ...uniqueMocks];
  } catch {
    return localMocks;
  }
}

function TasksSkeleton() {
  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}

function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = canCreateTasks(user?.role);

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!user,
  });
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    enabled: !!user,
  });
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled: !!user,
  });
  const { data: roleMap } = useQuery({
    queryKey: ["user-role-map"],
    queryFn: fetchUserRoleMap,
    enabled: !!user,
    staleTime: 60_000,
  });

  const developers = useMemo(
    () =>
      (profiles ?? []).filter(
        (profile) => profile.is_active !== false && (roleMap ?? {})[profile.id] === "developer",
      ),
    [profiles, roleMap],
  );
  const nameOf = (id: string | null) =>
    id ? ((profiles ?? []).find((p) => p.id === id)?.username ?? id.slice(0, 8)) : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("High");
  const [newIsImportant, setNewIsImportant] = useState(false);
  const [newProjectId, setNewProjectId] = useState("none");
  const [newAssignee, setNewAssignee] = useState("none");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editIsImportant, setEditIsImportant] = useState(false);
  const [editProjectId, setEditProjectId] = useState("none");
  const [editAssignee, setEditAssignee] = useState("none");

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterMine, setFilterMine] = useState(false);
  const [search, setSearch] = useState("");


  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("tasks").insert({
        title: newTitle.trim(),
        description: newDesc || null,
        priority: newPriority,
        is_important: newIsImportant,
        project_id: newProjectId === "none" ? null : Number(newProjectId),
        assigned_to: newAssignee === "none" ? null : newAssignee,
        created_by: user.id,
        status: "Pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTitle("");
      setNewDesc("");
      setNewPriority("High");
      setNewIsImportant(false);
      setNewProjectId("none");
      setNewAssignee("none");
      setCreateOpen(false);
      toast.success("Task created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: editTitle,
          description: editDesc || null,
          priority: editPriority,
          status: editStatus,
          is_important: editIsImportant,
          project_id: editProjectId === "none" ? null : Number(editProjectId),
          assigned_to: editAssignee === "none" ? null : editAssignee,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setEditingId(null);
      toast.success("Task updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setDeleteId(null);
      toast.success("Task deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditIsImportant(task.is_important ?? false);
    setEditProjectId(task.project_id ? String(task.project_id) : "none");
    setEditAssignee(task.assigned_to ?? "none");
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tasks ?? [])
      .filter((t) => filterStatus === "All" || t.status === filterStatus)
      .filter((t) => filterPriority === "All" || t.priority === filterPriority)
      .filter((t) => !filterImportant || t.is_important === true)
      .filter((t) => !filterMine || t.assigned_to === user?.id)
      .filter((t) => !term || t.title.toLowerCase().includes(term))

      .sort((a, b) => {
        if (a.is_important && !b.is_important) return -1;
        if (!a.is_important && b.is_important) return 1;
        return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
      });
  }, [tasks, filterStatus, filterPriority, filterImportant, filterMine, search, user?.id]);

  const pendingCount = (tasks ?? []).filter((t) => t.status === "Pending").length;
  const inProgressCount = (tasks ?? []).filter((t) => t.status === "In Progress").length;
  const doneCount = (tasks ?? []).filter((t) => t.status === "Done").length;

  const projectName = (id: number | null) => {
    if (!id) return null;
    return (projects ?? []).find((p) => p.id === id)?.name ?? null;
  };

  if (isLoading) return <TasksSkeleton />;

  return (
    <div className="mx-auto max-w-[1000px] space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardList className="h-6 w-6 text-primary" />
            Priority Tasks
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tasks
              ? `${tasks.length} total · ${pendingCount} pending · ${inProgressCount} in progress · ${doneCount} done`
              : "Loading..."}
          </p>
        </div>

        {canManage && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
                <DialogDescription>Add a new task for the team to prioritize.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Project</label>
                  <Select value={newProjectId} onValueChange={setNewProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {(projects ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.key} · {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    placeholder="Task title..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Optional details..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Assign to developer</label>
                  <Select value={newAssignee} onValueChange={setNewAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {developers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3">

                  <div className="flex items-center gap-1.5 text-sm font-medium text-warning">
                    <Star className="h-4 w-4" />
                    Important task
                  </div>
                  <Switch checked={newIsImportant} onCheckedChange={setNewIsImportant} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newTitle.trim() || createMutation.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={filterImportant} onCheckedChange={setFilterImportant} />
          Important only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={filterMine} onCheckedChange={setFilterMine} />
          Assigned to me
        </label>

      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No tasks match your filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((task) => (
            <Card key={task.id} className={task.is_important ? "border-warning/40" : undefined}>
              <CardContent className="space-y-3 pt-5">
                {editingId === task.id ? (
                  <div className="space-y-3">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="min-h-[70px]"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={editProjectId} onValueChange={setEditProjectId}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No project</SelectItem>
                          {(projects ?? []).map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={editIsImportant} onCheckedChange={setEditIsImportant} />
                        Important
                      </label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateMutation.mutate(task.id)}
                        disabled={updateMutation.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {task.is_important && <Star className="h-4 w-4 text-warning" />}
                        <p className="font-medium">{task.title}</p>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <InteractiveStatusEditor
                          itemId={task.id}
                          type="task"
                          currentStatus={task.status}
                          canEdit={canManage}
                          size="sm"
                        />
                        <Badge variant="outline" className={priorityTone(task.priority)}>
                          {task.priority}
                        </Badge>
                        {projectName(task.project_id) && (
                          <Badge variant="secondary">{projectName(task.project_id)}</Badge>
                        )}
                      </div>
                      <div className="pt-1 sm:max-w-xs">
                        <TaskTimer taskId={task.id} />
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit task ${task.title}`}
                          onClick={() => startEdit(task)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete task ${task.title}`}
                          onClick={() => setDeleteId(task.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
