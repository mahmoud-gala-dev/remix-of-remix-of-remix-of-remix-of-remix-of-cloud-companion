import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useBugNotifier } from "@/hooks/useBugNotifier";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Pencil, Check, ClipboardList, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BUG_STATUSES,
  BUG_PRIORITIES,
  BUG_SEVERITIES,
  statusTone,
  priorityTone,
  friendlyDbError,
  type Bug,
  type Profile,
} from "@/lib/api";
import { BugQuickStatus } from "@/components/bugs/BugQuickStatus";
import { AssigneeSelect } from "@/components/bugs/AssigneeSelect";
import { nameFor, type ProfileMap } from "@/components/bugs/types";


function EmptyValue({ label = "Not set" }: { label?: string }) {
  return <span className="text-muted-foreground">{label}</span>;
}

function DetailField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="min-h-9 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border/70 pb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

type BugUpdateValue = string | string[] | null;

export function BugInfoPanel({
  bug,
  profiles,
  profileMap,
  canEdit,
  canEditStatus,
}: {
  bug: Bug;
  profiles: Profile[];
  profileMap: ProfileMap;
  canEdit: boolean;
  canEditStatus?: boolean;
}) {
  const queryClient = useQueryClient();
  const notifyBug = useBugNotifier();
  const [editingModule, setEditingModule] = useState(false);
  const [moduleValue, setModuleValue] = useState(bug.module ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(bug.notes ?? "");
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setModuleValue(bug.module ?? "");
    setNotesValue(bug.notes ?? "");
  }, [bug.module, bug.notes]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bug", bug.id] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["bug-history", bug.id] });
    queryClient.invalidateQueries({ queryKey: ["bugs"] });
  };

  const updateField = useMutation({
    mutationFn: async ({
      field,
      value,
    }: {
      field: keyof Bug;
      value: BugUpdateValue;
      label: string;
    }) => {
      const { error } = await supabase
        .from("bugs")
        .update({ [field]: value } as never)
        .eq("id", bug.id);
      // History entries and notifications are written by database triggers.
      if (error) throw new Error(friendlyDbError(error));
      return { field, value };
    },
    onMutate: async ({ field, value }) => {
      await queryClient.cancelQueries({ queryKey: ["bug", bug.id] });
      const previous = queryClient.getQueryData<Bug | null>(["bug", bug.id]);
      queryClient.setQueryData<Bug | null>(["bug", bug.id], (current) =>
        current ? { ...current, [field]: value } : current,
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["bug", bug.id], context.previous);
      }
      toast.error(err.message);
    },
    onSuccess: ({ field }) => {
      invalidate();
      if (field === "assigned_to") notifyBug({ kind: "assigned", bugId: bug.id });
      toast.success("Bug updated");
    },
  });

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const current = bug.tags ?? [];
    if (current.includes(tag)) {
      setTagInput("");
      return;
    }
    updateField.mutate({ field: "tags", value: [...current, tag], label: "tags" });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    const current = bug.tags ?? [];
    updateField.mutate({ field: "tags", value: current.filter((t) => t !== tag), label: "tags" });
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="text-base">Bug Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Review status, ownership, reproduction steps, and technical context.
        </p>
      </CardHeader>
      <CardContent className="space-y-7">
        <DetailSection title="Workflow" icon={<Settings2 className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailField
              label="Status"
              value={
                <BugQuickStatus
                  bugId={bug.id}
                  status={bug.status}
                  canEdit={canEditStatus ?? canEdit}
                  size="md"
                  className="w-full"
                />
              }
            />
            <DetailField
              label="Priority"
              value={
                canEdit ? (
                  <Select
                    value={bug.priority}
                    disabled={updateField.isPending}
                    onValueChange={(v) =>
                      updateField.mutate({ field: "priority", value: v, label: "priority" })
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={priorityTone(bug.priority)}>
                    {bug.priority}
                  </Badge>
                )
              }
            />
            <DetailField
              label="Severity"
              value={
                canEdit ? (
                  <Select
                    value={bug.severity}
                    disabled={updateField.isPending}
                    onValueChange={(v) =>
                      updateField.mutate({ field: "severity", value: v, label: "severity" })
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUG_SEVERITIES.map((severity) => (
                        <SelectItem key={severity} value={severity}>
                          {severity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={priorityTone(bug.severity)}>
                    {bug.severity}
                  </Badge>
                )
              }
            />
            <DetailField
              label="Assignee"
              value={
                canEdit ? (
                  <AssigneeSelect
                    profiles={profiles}
                    value={bug.assigned_to}
                    disabled={updateField.isPending}
                    onChange={(next) =>
                      updateField.mutate({
                        field: "assigned_to",
                        value: next,
                        label: "assignee",
                      })
                    }
                  />
                ) : (
                  nameFor(profileMap, bug.assigned_to)
                )
              }
            />

          </div>
        </DetailSection>

        <DetailSection title="Context" icon={<ClipboardList className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField label="Reporter" value={nameFor(profileMap, bug.reported_by)} />
            <DetailField
              label="Module"
              value={
                editingModule ? (
                  <div className="flex gap-2">
                    <Input
                      value={moduleValue}
                      onChange={(e) => setModuleValue(e.target.value)}
                      disabled={updateField.isPending}
                      className="h-9 bg-background"
                    />
                    <Button
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={updateField.isPending || !moduleValue.trim()}
                      onClick={() => {
                        updateField.mutate({
                          field: "module",
                          value: moduleValue,
                          label: "module",
                        });
                        setEditingModule(false);
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex min-h-5 w-full items-center justify-between gap-2 text-left hover:text-primary disabled:cursor-default disabled:hover:text-foreground"
                    disabled={!canEdit}
                    onClick={() => canEdit && setEditingModule(true)}
                  >
                    <span>{bug.module || <EmptyValue />}</span>
                    {canEdit && <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                )
              }
            />
            <DetailField
              label="Environment"
              value={bug.environment || <EmptyValue />}
              className="md:col-span-2"
            />
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </p>
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              {(bug.tags ?? []).length > 0 ? (
                (bug.tags ?? []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1.5">
                    {tag}
                    {canEdit && (
                      <button
                        type="button"
                        className="rounded-sm hover:text-destructive"
                        onClick={() => removeTag(tag)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))
              ) : (
                <EmptyValue label="No tags" />
              )}
              {canEdit && (
                <div className="ml-auto flex items-center gap-1.5">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    disabled={updateField.isPending}
                    placeholder="Add tag"
                    className="h-8 w-32 bg-background text-xs"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 bg-background"
                    disabled={updateField.isPending}
                    onClick={addTag}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Reproduction" icon={<ClipboardList className="h-4 w-4" />}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailField
              label="Steps to Reproduce"
              className="md:col-span-2"
              value={<p className="whitespace-pre-wrap leading-6">{bug.steps || <EmptyValue />}</p>}
            />
            <DetailField
              label="Expected Result"
              value={
                <span className="whitespace-pre-wrap leading-6">
                  {bug.expected_result || <EmptyValue />}
                </span>
              }
            />
            <DetailField
              label="Actual Result"
              value={
                <span className="whitespace-pre-wrap leading-6">
                  {bug.actual_result || <EmptyValue />}
                </span>
              }
            />
          </div>
        </DetailSection>

        <DetailSection title="Notes" icon={<Pencil className="h-4 w-4" />}>
          {editingNotes ? (
            <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                disabled={updateField.isPending}
                rows={4}
                className="bg-background"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={updateField.isPending}
                  onClick={() => {
                    updateField.mutate({ field: "notes", value: notesValue, label: "notes" });
                    setEditingNotes(false);
                  }}
                >
                  {updateField.isPending ? "Saving..." : "Save notes"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="block min-h-16 w-full whitespace-pre-wrap rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-left text-sm leading-6 text-foreground hover:border-primary/40 hover:text-primary disabled:cursor-default disabled:hover:border-border/70 disabled:hover:text-foreground"
              disabled={!canEdit}
              onClick={() => canEdit && setEditingNotes(true)}
            >
              {bug.notes || <EmptyValue label={canEdit ? "Click to add notes" : "No notes"} />}
            </button>
          )}
        </DetailSection>
      </CardContent>
    </Card>
  );
}
