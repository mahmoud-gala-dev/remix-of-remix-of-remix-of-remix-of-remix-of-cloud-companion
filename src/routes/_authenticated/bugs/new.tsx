import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFound } from "@/components/layout/route-boundaries";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useBugNotifier } from "@/hooks/useBugNotifier";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { canReportBugs } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchProjects,
  fetchProfiles,
  friendlyDbError,
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  BUG_STATUSES,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/bugs/new")({
  head: () => ({
    meta: [
      { title: "Report New Bug | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "File a new bug report with full details for your QA team.",
      },
      { property: "og:title", content: "Report New Bug | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "File a new bug report with full details for your QA team.",
      },
    ],
  }),
  component: NewBugPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFound label="page" />,
});

const bugSchema = z.object({
  bug_id: z.string().min(1, "Bug ID is required"),
  title: z.string().min(1, "Title is required"),
  module: z.string().min(1, "Module is required"),
  priority: z.enum(BUG_PRIORITIES),
  severity: z.enum(BUG_SEVERITIES),
  status: z.enum(BUG_STATUSES),
  environment: z.string().optional(),
  steps: z.string().optional(),
  expected_result: z.string().optional(),
  actual_result: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  project_id: z.string(),
  assigned_to: z.string(),
});

type BugFormValues = z.infer<typeof bugSchema>;

function NewBugPage() {
  const navigate = useNavigate();
  const notifyBug = useBugNotifier();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const canReport = canReportBugs(user?.role);

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  const form = useForm<BugFormValues>({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      bug_id: "",
      title: "",
      module: "",
      priority: "Medium",
      severity: "Major" as (typeof BUG_SEVERITIES)[number],
      status: "Open",
      environment: "",
      steps: "",
      expected_result: "",
      actual_result: "",
      notes: "",
      tags: "",
      project_id: "none",
      assigned_to: "none",
    },
  });

  if (user && !canReport) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Reporting is limited to QA roles</h1>
        <p className="text-sm text-muted-foreground">
          Developers can update and resolve bugs, but only testers, supervisors and admins can file
          new ones.
        </p>
        <Button asChild variant="outline">
          <Link to="/bugs">
            <ArrowLeft className="me-1.5 h-4 w-4" /> Back to bugs
          </Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(values: BugFormValues) {
    if (!canReport) {
      toast.error("Your role cannot report bugs.");
      return;
    }
    if (!user) {
      toast.error("You must be signed in to report a bug.");
      return;
    }
    const tags = values.tags
      ? values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const { data, error } = await supabase
      .from("bugs")
      .insert({
        bug_id: values.bug_id,
        title: values.title,
        module: values.module,
        priority: values.priority,
        severity: values.severity,
        status: values.status,
        environment: values.environment || null,
        steps: values.steps || null,
        expected_result: values.expected_result || null,
        actual_result: values.actual_result || null,
        notes: values.notes || null,
        tags,
        project_id: values.project_id === "none" ? null : Number(values.project_id),
        assigned_to: values.assigned_to === "none" ? null : values.assigned_to,
        reported_by: user.id,
      })
      .select()
      .single();

    if (error || !data) {
      const message = friendlyDbError(error);
      if (error?.code === "23505" || /Bug ID is already in use/.test(message)) {
        form.setError("bug_id", { type: "manual", message: "That Bug ID is already in use." });
        toast.error("That Bug ID is already in use.");
      } else {
        toast.error("Failed to create bug", { description: message });
      }
      return;
    }

    // The assignee is notified by a database trigger on bugs.
    notifyBug({ kind: "created", bugId: data.id as number, toStatus: values.status });

    toast.success("Bug created successfully.");
    queryClient.invalidateQueries({ queryKey: ["bugs"] });
    navigate({ to: "/bugs/$id", params: { id: String(data.id) } });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/bugs">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Report New Bug</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Bug Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bug_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bug ID</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. BUG-101" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="module"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Module</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Authentication, Checkout" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="environment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environment</FormLabel>
                        <FormControl>
                          <Input placeholder="Browser, OS, App Version" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="steps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Steps to Reproduce</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={"1. Go to...\n2. Click on...\n3. Observe..."}
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="expected_result"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Result</FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[100px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="actual_result"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Actual Result</FormLabel>
                          <FormControl>
                            <Textarea className="min-h-[100px]" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tags</FormLabel>
                        <FormControl>
                          <Input placeholder="comma, separated, tags" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[80px]"
                            placeholder="Any other context..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Properties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BUG_PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BUG_SEVERITIES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BUG_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="No project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No project</SelectItem>
                            {(projects ?? []).map((project) => (
                              <SelectItem key={project.id} value={String(project.id)}>
                                {project.key} · {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Assign the bug to a project when applicable.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {(profiles ?? []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.username}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Submitting..." : "Submit Bug Report"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
