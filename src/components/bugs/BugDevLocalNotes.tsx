import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Database,
  Plus,
  StickyNote,
  Copy,
  CheckCheck,
  Edit2,
  Trash2,
  X,
  Save,
  Code2,
  Lightbulb,
  Search,
  Wrench,
  Bell,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import {
  getDevLocalNotes,
  addDevLocalNote,
  updateDevLocalNote,
  deleteDevLocalNote,
  type DevLocalNote,
  type DevLocalNoteCategory,
} from "@/lib/dev-local-notes";

const CATEGORY_CONFIG: Record<
  DevLocalNoteCategory,
  {
    icon: typeof Lightbulb;
    tone: string;
  }
> = {
  investigation: {
    icon: Search,
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  solution: {
    icon: Lightbulb,
    tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  workaround: {
    icon: Wrench,
    tone: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  code: {
    icon: Code2,
    tone: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  reminder: {
    icon: Bell,
    tone: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  general: {
    icon: HelpCircle,
    tone: "border-border/80 bg-muted/60 text-foreground",
  },
};

const CATEGORIES: DevLocalNoteCategory[] = [
  "general",
  "investigation",
  "solution",
  "workaround",
  "code",
  "reminder",
];

export function BugDevLocalNotes({ bugId }: { bugId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form draft state for creation
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState<DevLocalNoteCategory>("general");

  // Form draft state for editing
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<DevLocalNoteCategory>("general");

  const queryKey = ["bug-dev-local-notes", bugId];

  const { data: notes = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getDevLocalNotes(bugId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addDevLocalNote({
        bugId,
        title: draftTitle,
        content: draftContent,
        category: draftCategory,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("bug.devLocalNotes.toast.created"));
      setIsAdding(false);
      setDraftTitle("");
      setDraftContent("");
      setDraftCategory("general");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save note");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      updateDevLocalNote(id, {
        title: editTitle,
        content: editContent,
        category: editCategory,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("bug.devLocalNotes.toast.updated"));
      setEditingId(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update note");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDevLocalNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("bug.devLocalNotes.toast.deleted"));
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete note");
    },
  });

  const handleStartEdit = (note: DevLocalNote) => {
    setEditingId(note.id);
    setEditTitle(note.title || "");
    setEditContent(note.content);
    setEditCategory(note.category);
  };

  const handleCopyNote = (note: DevLocalNote) => {
    const text = note.title ? `${note.title}\n\n${note.content}` : note.content;
    void navigator.clipboard.writeText(text);
    setCopiedId(note.id);
    toast.success(t("bug.devLocalNotes.toast.copied"));
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-primary" />
            <span>{t("bug.devLocalNotes.title")}</span>
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 text-[11px] font-normal text-primary"
            >
              <Database className="h-3 w-3" />
              {t("bug.devLocalNotes.dbBadge")}
              {notes.length > 0 && <span className="ms-0.5 font-semibold">({notes.length})</span>}
            </Badge>
          </CardTitle>

          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs bg-background/80"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("bug.devLocalNotes.add")}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Create Note Form */}
        {isAdding && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" />
                {t("bug.devLocalNotes.add")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsAdding(false);
                  setDraftTitle("");
                  setDraftContent("");
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Category selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("bug.devLocalNotes.field.category")}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;
                  const isSelected = draftCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDraftCategory(cat)}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                        isSelected
                          ? `${cfg.tone} ring-1 ring-primary/40 font-semibold shadow-xs`
                          : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {t(`bug.devLocalNotes.category.${cat}` as any)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title (optional) */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("bug.devLocalNotes.field.title")}
              </label>
              <Input
                placeholder={t("bug.devLocalNotes.field.titlePlaceholder")}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {t("bug.devLocalNotes.field.content")}
              </label>
              <Textarea
                placeholder={t("bug.devLocalNotes.field.contentPlaceholder")}
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={3}
                className="text-xs resize-y bg-background font-sans"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setIsAdding(false);
                  setDraftTitle("");
                  setDraftContent("");
                }}
              >
                {t("bug.devLocalNotes.btn.cancel")}
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={!draftContent.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                <Save className="h-3.5 w-3.5" />
                {t("bug.devLocalNotes.btn.save")}
              </Button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && notes.length === 0 && !isAdding && (
          <div className="rounded-lg border border-dashed border-border/80 p-4 text-center">
            <StickyNote className="mx-auto h-6 w-6 text-muted-foreground/60 mb-1.5" />
            <p className="text-xs font-medium text-muted-foreground">
              {t("bug.devLocalNotes.empty")}
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">
              {t("bug.devLocalNotes.emptyHint")}
            </p>
          </div>
        )}

        {/* Timeline list of local developer notes */}
        {!isLoading && notes.length > 0 && (
          <div className="relative space-y-4 ps-4 before:absolute before:bottom-1 before:start-1.5 before:top-2 before:w-0.5 before:bg-border/60">
            {notes.map((note) => {
              const isEditingThis = editingId === note.id;
              const catCfg = CATEGORY_CONFIG[note.category] || CATEGORY_CONFIG.general;
              const CatIcon = catCfg.icon;

              if (isEditingThis) {
                return (
                  <div
                    key={note.id}
                    className="relative rounded-lg border border-primary/40 bg-card p-3 space-y-2.5 text-xs shadow-xs"
                  >
                    <span className="absolute -start-[1.35rem] top-3 h-2 w-2 rounded-full border border-background bg-primary ring-2 ring-primary/20" />

                    <div className="flex flex-wrap gap-1">
                      {CATEGORIES.map((cat) => {
                        const isSel = editCategory === cat;
                        const cfg = CATEGORY_CONFIG[cat];
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setEditCategory(cat)}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium border ${
                              isSel
                                ? `${cfg.tone} font-semibold`
                                : "border-border/60 bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {t(`bug.devLocalNotes.category.${cat}` as any)}
                          </button>
                        );
                      })}
                    </div>

                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder={t("bug.devLocalNotes.field.titlePlaceholder")}
                      className="h-7 text-xs"
                    />

                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="text-xs resize-y"
                    />

                    <div className="flex justify-end gap-1.5 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setEditingId(null)}
                      >
                        {t("bug.devLocalNotes.btn.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-xs px-2"
                        disabled={!editContent.trim() || updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: note.id })}
                      >
                        {t("bug.devLocalNotes.btn.save")}
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={note.id} className="relative group text-sm flex flex-col gap-1">
                  {/* Timeline dot */}
                  <span className="absolute -start-4 top-1.5 h-2 w-2 rounded-full border border-background bg-primary ring-2 ring-primary/20" />

                  {/* Note header line */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge
                        variant="outline"
                        className={`gap-1 px-1.5 py-0 text-[10px] font-medium ${catCfg.tone}`}
                      >
                        <CatIcon className="h-2.5 w-2.5" />
                        {t(`bug.devLocalNotes.category.${note.category}` as any)}
                      </Badge>
                      {note.title && (
                        <span className="font-semibold text-foreground text-xs truncate">
                          {note.title}
                        </span>
                      )}
                    </div>

                    {/* Actions toolbar */}
                    <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title={t("bug.devLocalNotes.btn.copy")}
                        onClick={() => handleCopyNote(note)}
                      >
                        {copiedId === note.id ? (
                          <CheckCheck className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title={t("bug.devLocalNotes.btn.edit")}
                        onClick={() => handleStartEdit(note)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            title={t("bug.devLocalNotes.btn.delete")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {t("bug.devLocalNotes.deleteConfirm")}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {note.title || note.content.slice(0, 80)}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              onClick={() => deleteMutation.mutate(note.id)}
                            >
                              {t("common.delete")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* Note Body */}
                  <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-xs text-foreground/90 whitespace-pre-wrap break-words leading-relaxed font-sans">
                    {note.content}
                  </div>

                  {/* Note Footer with time ago */}
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground/80 px-0.5">
                    <span>
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </span>
                    <span className="font-mono text-[9.5px] opacity-60">
                      {new Date(note.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
