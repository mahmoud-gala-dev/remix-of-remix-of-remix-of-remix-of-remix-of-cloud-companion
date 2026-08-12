import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AtSign, Bug, FolderKanban, Loader2, Paperclip, Pencil, Pin, PinOff, Reply, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { chatAttachmentUrl, messageTime, splitChatTokens, type ProjectMessage } from "@/lib/chat";
import { QUICK_REACTIONS, type ReactionGroup } from "@/lib/chat-reactions";

/** Opens a private chat attachment through a short-lived signed URL. */
export function AttachmentLink({ path, name }: { path: string; name: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const url = await chatAttachmentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chat.openFileError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={open}
      className="mt-1 flex max-w-full items-center gap-1.5 rounded-md border border-current/25 px-2 py-1 text-xs underline-offset-2 hover:underline"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}

/** Renders message text with @people, #bugs and ~projects highlighted and linked. */
function MessageBody({
  content,
  mine,
  onProjectClick,
}: {
  content: string;
  mine: boolean;
  onProjectClick: (key: string) => void;
}) {
  const chip = cn(
    "inline-flex items-center gap-0.5 rounded px-0.5 font-medium",
    mine ? "bg-primary-foreground/20" : "bg-primary/15 text-primary",
  );
  return (
    <p className="whitespace-pre-wrap break-words">
      {splitChatTokens(content).map((part, index) => {
        if (part.kind === "text") return <span key={index}>{part.text}</span>;
        if (part.kind === "bug") {
          return (
            <Link key={index} to="/bugs" search={{ q: part.value }} className={cn(chip, "hover:underline")}>
              <Bug className="h-3 w-3" aria-hidden="true" />
              {part.text}
            </Link>
          );
        }
        if (part.kind === "project") {
          return (
            <button
              key={index}
              type="button"
              onClick={() => onProjectClick(part.value)}
              className={cn(chip, "hover:underline")}
            >
              <FolderKanban className="h-3 w-3" aria-hidden="true" />
              {part.text}
            </button>
          );
        }
        return (
          <span key={index} className={chip}>
            {part.text}
          </span>
        );
      })}
    </p>
  );
}

export type ChatMessageItemProps = {
  message: ProjectMessage;
  mine: boolean;
  author: string;
  mentionsMe: boolean;
  parent: ProjectMessage | null;
  parentAuthor: string | null;
  groups: ReactionGroup[];
  canDelete: boolean;
  canReact: boolean;
  onReply: (message: ProjectMessage) => void;
  onEdit: (message: ProjectMessage) => void;
  onDelete: (id: number) => void;
  onPin: (id: number, pinned: boolean) => void;
  onReact: (messageId: number, emoji: string, existingId: number | null) => void;
  onProjectClick: (key: string) => void;
};

/** A single chat bubble with its actions, reply preview, reactions and attachment. */
export function ChatMessageItem({
  message,
  mine,
  author,
  mentionsMe,
  parent,
  parentAuthor,
  groups,
  canDelete,
  canReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
  onProjectClick,
}: ChatMessageItemProps) {
  const { t } = useI18n();
  const id = Number(message.id);
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{author.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "group max-w-[75%] rounded-2xl px-3 py-2 text-sm",
          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          mentionsMe && "ring-2 ring-primary/50",
        )}
      >
        <div className="mb-0.5 flex items-center gap-2 text-xs opacity-75">
          <span className="font-medium">{mine ? t("chat.you") : author}</span>
          <span>{messageTime(message.created_at)}</span>
          {message.edited_at && <span>{t("chat.edited")}</span>}
          {mentionsMe && (
            <span className="flex items-center gap-0.5 font-medium">
              <AtSign className="h-3 w-3" aria-hidden="true" />
              {t("chat.mentionedYou")}
            </span>
          )}
          {message.pinned_at && (
            <span className="flex items-center gap-0.5 font-medium">
              <Pin className="h-3 w-3" aria-hidden="true" />
              {t("chat.pinned")}
            </span>
          )}
          <button
            type="button"
            aria-label={t("chat.reply")}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onReply(message)}
          >
            <Reply className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label={message.pinned_at ? t("chat.unpin") : t("chat.pin")}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onPin(id, !message.pinned_at)}
          >
            {message.pinned_at ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
          </button>
          {mine && (
            <button
              type="button"
              aria-label={t("chat.edit")}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onEdit(message)}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              aria-label={t("chat.deleteMessage")}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onDelete(id)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>

        {parent && (
          <div
            className={cn(
              "mb-1 rounded-md border-s-2 px-2 py-1 text-xs",
              mine
                ? "border-primary-foreground/50 bg-primary-foreground/10"
                : "border-primary/50 bg-background/60",
            )}
          >
            <span className="font-medium">{parentAuthor ?? t("chat.you")}</span>
            <span className="ms-1 line-clamp-2 opacity-80">{parent.content}</span>
          </div>
        )}

        <MessageBody content={message.content} mine={mine} onProjectClick={onProjectClick} />

        {message.attachment_path && (
          <AttachmentLink
            path={message.attachment_path}
            name={message.attachment_name ?? t("chat.attachment")}
          />
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {groups.map((group) => (
            <button
              key={group.emoji}
              type="button"
              disabled={!canReact}
              onClick={() => onReact(id, group.emoji, group.mine)}
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                group.mine
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border/60 bg-background/60 text-foreground hover:bg-muted",
              )}
            >
              {group.emoji} {group.count}
            </button>
          ))}
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${t("chat.reactions")} ${emoji}`}
                disabled={!canReact}
                className="rounded-full px-1 text-xs hover:scale-125"
                onClick={() =>
                  onReact(id, emoji, groups.find((group) => group.emoji === emoji)?.mine ?? null)
                }
              >
                {emoji}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
