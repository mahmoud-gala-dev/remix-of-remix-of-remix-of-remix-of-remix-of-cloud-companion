import { Pin, PinOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ProjectMessage } from "@/lib/chat";

/** Compact list of the channel's pinned messages. */
export function ChatPinnedBar({
  pinned,
  currentUserId,
  nameFor,
  onUnpin,
}: {
  pinned: ProjectMessage[];
  currentUserId: string | null | undefined;
  nameFor: (id: string) => string;
  onUnpin: (id: number) => void;
}) {
  const { t } = useI18n();
  if (pinned.length === 0) return null;
  return (
    <div className="rounded-md border border-border/60 bg-muted/40 p-2">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Pin className="h-3.5 w-3.5" aria-hidden="true" />
        {t("chat.pinnedTitle")} ({pinned.length})
      </p>
      <ul className="space-y-1">
        {pinned.slice(0, 3).map((message) => (
          <li key={message.id} className="flex items-center gap-2 text-xs">
            <span className="font-medium">
              {message.user_id === currentUserId ? t("chat.you") : nameFor(message.user_id)}:
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{message.content}</span>
            <button
              type="button"
              aria-label={t("chat.unpin")}
              onClick={() => onUnpin(Number(message.id))}
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
