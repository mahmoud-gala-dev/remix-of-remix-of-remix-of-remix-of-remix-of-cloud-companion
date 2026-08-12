import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/common/UserAvatar";
import { Send, Pencil, Trash2, Check, X } from "lucide-react";
import { nameFor, type ProfileMap } from "@/components/bugs/types";
import { useBugComments } from "@/hooks/useBugComments";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function parseCommentDate(value: string | number | null | undefined): Date {
  if (!value) return new Date();
  if (typeof value === "number") return new Date(value);

  let normalized = String(value).trim();
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallbackParsed = new Date(value);
  if (!Number.isNaN(fallbackParsed.getTime())) {
    return fallbackParsed;
  }

  return new Date();
}

export function relativeCommentTime(value: string | null | undefined): string {
  if (!value) return "Just now";
  const date = parseCommentDate(value);
  const now = new Date();

  // If timestamp is slightly in the future relative to client time
  if (date.getTime() > now.getTime() - 2000) {
    return "Just now";
  }

  try {
    const text = formatDistanceToNow(date, { addSuffix: true });
    return text.includes("less than") ? "Just now" : text;
  } catch {
    return "Just now";
  }
}

export function BugComments({
  bugId,
  currentUserId,
  profileMap,
}: {
  bugId: number;
  currentUserId: string | null;
  profileMap: ProfileMap;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const { comments, isLoading, error, addComment, updateComment, deleteComment } = useBugComments(
    bugId,
    currentUserId,
  );

  /** Determine author display name safely with fallbacks */
  const getAuthorName = (commentUserId: string | null | undefined) => {
    if (!commentUserId || commentUserId === "unknown" || commentUserId === "Unassigned") {
      return user?.username || "Developer";
    }
    if (
      commentUserId === currentUserId ||
      (user?.id && commentUserId === user.id) ||
      commentUserId === "developer"
    ) {
      return user?.username || "You";
    }
    if (profileMap[commentUserId]) {
      return profileMap[commentUserId];
    }
    return commentUserId.length > 12 ? commentUserId.slice(0, 8) : commentUserId;
  };

  return (
    <Card id="comments" className="scroll-mt-24 border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {t("bug.comments")}
          {comments.length > 0 ? ` (${comments.length})` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {t("bug.comments.loadError")}: {error.message}
            </p>
          )}
          {comments.map((c) => {
            const isOwner =
              currentUserId === c.user_id ||
              (user?.id && user.id === c.user_id) ||
              c.user_id === "developer";
            const authorName = getAuthorName(c.user_id);
            const initials = authorName.slice(0, 2).toUpperCase() || "DV";

            return (
              <div key={c.id} className="flex gap-3">
                <UserAvatar userId={c.user_id} name={authorName} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{authorName}</span>
                    <span className="text-xs text-muted-foreground">
                      {relativeCommentTime(c.created_at)}
                    </span>
                  </div>
                  {editingId === c.id ? (
                    <div className="mt-1 space-y-2">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateComment.mutate(
                              { id: c.id, content: editingText },
                              {
                                onSuccess: () => setEditingId(null),
                                onError: (err) => toast.error(err.message),
                              },
                            )
                          }
                        >
                          <Check className="me-1 h-3.5 w-3.5" /> {t("common.save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="me-1 h-3.5 w-3.5" /> {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                      {c.content}
                    </p>
                  )}
                </div>
                {isOwner && editingId !== c.id && (
                  <div className="flex shrink-0 items-start gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditingText(c.content);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() =>
                        deleteComment.mutate(c.id, {
                          onError: (err) => toast.error(err.message),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && !error && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("bug.comments.empty")}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("bug.comments.placeholder")}
            rows={2}
            className="flex-1"
          />
          <Button
            size="icon"
            aria-label={t("bug.comments.send")}
            className="h-auto shrink-0"
            disabled={!text.trim() || addComment.isPending}
            onClick={() =>
              addComment.mutate(text.trim(), {
                onSuccess: () => setText(""),
                onError: (err) => toast.error(err.message),
              })
            }
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
