import { useEffect } from "react";

export type ShortcutHandler = (event: KeyboardEvent) => void;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

/**
 * Registers global keyboard shortcuts. Keys are matched case-insensitively and
 * ignored while the user is typing in a field (except for Escape and "?").
 */
export function useKeyboardShortcuts(map: Record<string, ShortcutHandler>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const handler = map[key];
      if (!handler) return;
      if (isTypingTarget(event.target) && key !== "Escape") return;
      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [map, enabled]);
}
