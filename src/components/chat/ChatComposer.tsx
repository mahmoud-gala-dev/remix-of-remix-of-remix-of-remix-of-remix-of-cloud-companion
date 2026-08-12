import { useCallback, useMemo, type RefObject } from "react";
import { AtSign, Bug, FolderKanban, Loader2, Paperclip, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import { useI18n } from "@/lib/i18n";
import {
  activeChatToken,
  applyChatToken,
  type ChatTokenKind,
  type ProjectMessage,
} from "@/lib/chat";

export type MentionSuggestion = { kind: ChatTokenKind; value: string; label: string };

export type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  disabled: boolean;
  sending: boolean;
  editing: ProjectMessage | null;
  replyTo: ProjectMessage | null;
  pendingFile: File | null;
  replyAuthor: string | null;
  onCancelContext: () => void;
  onPickFile: (file: File | null) => void;
  onSubmit: () => void;
  onTyping: () => void;
  suggestionsFor: (kind: ChatTokenKind, query: string) => MentionSuggestion[];
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileRef: RefObject<HTMLInputElement | null>;
};

const KIND_ICON = { user: AtSign, bug: Bug, project: FolderKanban } as const;

/**
 * Message composer: attachments, emoji, and `@person` / `#bug` / `~project`
 * autocomplete driven by the token under the caret.
 */
export function ChatComposer({
  draft,
  onDraftChange,
  disabled,
  sending,
  editing,
  replyTo,
  pendingFile,
  replyAuthor,
  onCancelContext,
  onPickFile,
  onSubmit,
  onTyping,
  suggestionsFor,
  inputRef,
  fileRef,
}: ChatComposerProps) {
  const { t } = useI18n();

  const caret = () => inputRef.current?.selectionStart ?? draft.length;

  const token = useMemo(() => {
    if (typeof document === "undefined") return null;
    return activeChatToken(draft, inputRef.current?.selectionStart ?? draft.length);
    // Recomputed on every draft change; caret moves also trigger a draft-sync click handler.
  }, [draft, inputRef]);

  const suggestions = token ? suggestionsFor(token.kind, token.query) : [];

  const pick = useCallback(
    (suggestion: MentionSuggestion) => {
      const position = caret();
      const next = applyChatToken(draft, position, suggestion.kind, suggestion.value);
      onDraftChange(next.value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(next.caret, next.caret);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, onDraftChange, inputRef],
  );

  const canSubmit = !disabled && (draft.trim().length > 0 || (!editing && pendingFile !== null));

  return (
    <form
      className="relative border-t border-border/60 pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit();
      }}
    >
      {(replyTo || editing || pendingFile) && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-xs">
          <span className="font-medium">
            {editing ? t("chat.editing") : replyTo ? t("chat.replyingTo") : t("chat.attachment")}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {editing
              ? editing.content
              : replyTo
                ? `${replyAuthor ?? ""}: ${replyTo.content}`
                : pendingFile?.name}
          </span>
          <button type="button" aria-label={t("common.cancel")} onClick={onCancelContext}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="absolute bottom-full start-0 z-20 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {suggestions.map((suggestion) => {
            const Icon = KIND_ICON[suggestion.kind];
            return (
              <li key={`${suggestion.kind}-${suggestion.value}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
                  onClick={() => pick(suggestion)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t(
                      suggestion.kind === "user"
                        ? "chat.mentionUser"
                        : suggestion.kind === "bug"
                          ? "chat.mentionBug"
                          : "chat.mentionProject",
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          aria-label={t("chat.attach")}
          disabled={disabled || editing !== null}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <EmojiPicker
          label={t("chat.reactions")}
          disabled={disabled}
          onPick={(emoji) => {
            onDraftChange(`${draft}${emoji}`);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
            onTyping();
          }}
          onClick={() => onDraftChange(draft)}
          placeholder={disabled ? t("chat.selectProjectFirst") : t("chat.placeholder")}
          disabled={disabled}
          rows={2}
          className="resize-none"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (suggestions[0] && token) {
                pick(suggestions[0]);
                return;
              }
              if (canSubmit) onSubmit();
            }
          }}
        />
        <Button
          type="submit"
          disabled={!canSubmit || sending}
          aria-label={editing ? t("chat.saveMessage") : t("chat.send")}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{t("chat.mentionHint")}</p>
    </form>
  );
}
