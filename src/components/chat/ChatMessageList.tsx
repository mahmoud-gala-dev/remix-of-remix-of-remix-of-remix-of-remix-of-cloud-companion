import { useEffect, useRef } from "react";
import { ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { messageDay, type ProjectMessage } from "@/lib/chat";
import { ChatMessageItem, type ChatMessageItemProps } from "@/components/chat/ChatMessageItem";

type ItemHandlers = Pick<
  ChatMessageItemProps,
  "onReply" | "onEdit" | "onDelete" | "onPin" | "onReact" | "onProjectClick"
>;

export type ChatMessageListProps = ItemHandlers & {
  messages: ProjectMessage[];
  byId: Map<number, ProjectMessage>;
  currentUserId: string | null | undefined;
  currentUsername: string | null | undefined;
  nameFor: (id: string) => string;
  mentionsMe: (content: string) => boolean;
  groupsFor: (messageId: number) => ChatMessageItemProps["groups"];
  canDelete: (message: ProjectMessage) => boolean;
  canReact: boolean;
  isLoading: boolean;
  isError: boolean;
  emptyLabel: string;
  /** Older-history paging. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadOlder: () => void;
};

/**
 * Scrollable transcript. Sticks to the newest message, and reveals a
 * "load older" control (auto-triggered near the top) for incremental history.
 */
export function ChatMessageList({
  messages,
  byId,
  currentUserId,
  nameFor,
  mentionsMe,
  groupsFor,
  canDelete,
  canReact,
  isLoading,
  isError,
  emptyLabel,
  hasMore,
  loadingMore,
  onLoadOlder,
  ...handlers
}: ChatMessageListProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const previousCount = useRef(0);

  /* Keep pinned to the bottom for new messages, but stay put when older pages prepend. */
  useEffect(() => {
    const grewAtBottom = messages.length > previousCount.current;
    previousCount.current = messages.length;
    if (!grewAtBottom) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node || !hasMore || loadingMore) return;
    if (node.scrollTop < 48) onLoadOlder();
  };

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 space-y-3 overflow-y-auto pe-1"
      style={{ maxHeight: "52vh" }}
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <p className="py-10 text-center text-sm text-destructive">{t("chat.loadError")}</p>
      ) : messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLoadOlder}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="ms-1.5">{t("chat.loadOlder")}</span>
              </Button>
            </div>
          )}
          {!hasMore && messages.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">{t("chat.historyStart")}</p>
          )}
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay =
              index === 0 ||
              messageDay(previous?.created_at ?? message.created_at) !== messageDay(message.created_at);
            const parent = message.reply_to_id ? byId.get(Number(message.reply_to_id)) ?? null : null;
            return (
              <div key={message.id} className="space-y-3">
                {showDay && (
                  <div className="flex items-center justify-center">
                    <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
                      {messageDay(message.created_at)}
                    </span>
                  </div>
                )}
                <ChatMessageItem
                  message={message}
                  mine={message.user_id === currentUserId}
                  author={nameFor(message.user_id)}
                  mentionsMe={message.user_id !== currentUserId && mentionsMe(message.content)}
                  parent={parent}
                  parentAuthor={
                    parent
                      ? parent.user_id === currentUserId
                        ? t("chat.you")
                        : nameFor(parent.user_id)
                      : null
                  }
                  groups={groupsFor(Number(message.id))}
                  canDelete={canDelete(message)}
                  canReact={canReact}
                  {...handlers}
                />
              </div>
            );
          })}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
