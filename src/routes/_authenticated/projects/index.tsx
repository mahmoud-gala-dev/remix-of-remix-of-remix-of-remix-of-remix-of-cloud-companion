import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchBugs, fetchProjects, type Project } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Browse project workspaces, bug counts, and status across teams.",
      },
      { property: "og:title", content: "Projects | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Create and manage project workspaces for bug tracking.",
      },
    ],
  }),
  component: ProjectsPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const STATUS_OPTIONS = ["Active", "Paused", "Archived"];

const statusStyles: Record<string, string> = {
  Active: "bg-success/15 text-success border-success/30",
  Paused: "bg-warning/15 text-warning border-warning/30",
  Archived: "bg-muted text-muted-foreground border-border",
};

type FormValues = { name: string; key: string; description: string; status: string };
const EMPTY_VALUES: FormValues = { name: "", key: "", description: "", status: "Active" };

function ProjectsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}

function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    enabled: !!user,
  });
  const { data: bugs } = useQuery({ queryKey: ["bugs"], queryFn: fetchBugs, enabled: !!user });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);

  const openCreate = () => {
    setEditingProject(null);
    setValues(EMPTY_VALUES);
    setDialogOpen(true);
  };
  const openEdit = (project: Project) => {
    setEditingProject(project);
    setValues({
      name: project.name,
      key: project.key,
      description: project.description ?? "",
      status: project.status ?? "Active",
    });
    setDialogOpen(true);
  };

  const bugCountByProject = useMemo(() => {
    const map = new Map<number, number>();
    for (const bug of bugs ?? []) {
      if (bug.project_id) map.set(bug.project_id, (map.get(bug.project_id) ?? 0) + 1);
    }
    return map;
  }, [bugs]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects ?? [];
    return (projects ?? []).filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.key.toLowerCase().includes(term) ||
        (p.description ?? "").toLowerCase().includes(term),
    );
  }, [projects, search]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const payload = {
        name: values.name.trim(),
        key: values.key.trim().toUpperCase(),
        description: values.description.trim() || null,
        status: values.status,
      };
      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", editingProject.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("projects")
          .insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDialogOpen(false);
      toast.success(editingProject ? "Project updated" : "Project created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteTarget(null);
      toast.success("Project deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <ProjectsSkeleton />;

  const activeCount = (projects ?? []).filter((p) => p.status === "Active").length;
  const totalBugs = bugs?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-background px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              <FolderKanban className="h-4 w-4" />
              Workspace directory
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Projects</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Keep QA work focused. Each project scopes bugs and tasks for a team.
            </p>
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} className="shrink-0">
                  <Plus className="me-2 h-4 w-4" />
                  New project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProject ? "Edit project" : "Create project"}</DialogTitle>
                  <DialogDescription>
                    Set the project's name, key, description and status.
                  </DialogDescription>
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
                      placeholder="e.g. WEB"
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
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={
                      !values.name.trim() || values.key.trim().length < 2 || saveMutation.isPending
                    }
                  >
                    {editingProject ? "Save" : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Workspaces</p>
            <p className="text-2xl font-bold">{projects?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Active now</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs uppercase text-muted-foreground">Tracked bugs</p>
            <p className="text-2xl font-bold">{totalBugs}</p>
          </CardContent>
        </Card>
      </section>

      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects"
          className="h-9 ps-9"
        />
      </div>

      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            No projects found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="font-mono text-xs">{project.key}</CardDescription>
                  </div>
                  <Badge variant="outline" className={statusStyles[project.status ?? ""] ?? ""}>
                    {project.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="line-clamp-3 text-sm text-muted-foreground">
                  {project.description || "No description"}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {bugCountByProject.get(project.id) ?? 0} bugs
                  </span>
                  <div className="flex items-center gap-1">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/projects/$id" params={{ id: String(project.id) }}>
                        Open
                      </Link>
                    </Button>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(project)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(project)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the project. Related bugs and tasks are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
