import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { notifyBugEvent } from "@/lib/integrations.functions";

export type BugNotification = {
  kind: "created" | "status" | "assigned";
  bugId: number;
  fromStatus?: string | null;
  toStatus?: string | null;
};

/**
 * Fire-and-forget Slack + push notification for a bug event.
 * Failures are logged only — they must never block the UI action that triggered them.
 */
export function useBugNotifier() {
  const notify = useServerFn(notifyBugEvent);

  return useCallback(
    (event: BugNotification) => {
      const origin = typeof window === "undefined" ? null : window.location.origin;
      void notify({ data: { ...event, origin } }).catch((error: unknown) => {
        console.warn("Bug notification could not be sent:", error);
      });
    },
    [notify],
  );
}
