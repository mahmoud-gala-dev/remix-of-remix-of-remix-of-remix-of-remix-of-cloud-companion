import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/* The module is browser-only (Web Audio, localStorage, speech), so it is loaded
   after hydration instead of during SSR. */
const PomodoroApp = lazy(() => import("@/pomodoro/App"));

export const Route = createFileRoute("/_authenticated/pomodoro")({
  head: () => ({
    meta: [
      { title: "Pomodoro Focus | ElectroPI Bug Tracker" },
      {
        name: "description",
        content: "Focus timer, task lists and session analytics for developers.",
      },
      { property: "og:title", content: "Pomodoro Focus | ElectroPI Bug Tracker" },
      {
        property: "og:description",
        content: "Focus timer, task lists and session analytics for developers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PomodoroPage,
});

function PomodoroPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const canUse = user?.role === "developer" || user?.role === "admin";

  return (
    <Shell>
      {!canUse ? (
        <p className="p-6 text-sm text-muted-foreground">{t("pomodoro.noAccess")}</p>
      ) : (
        <ClientOnly fallback={<p className="p-6 text-sm text-muted-foreground">…</p>}>
          <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">…</p>}>
            <PomodoroApp />
          </Suspense>
        </ClientOnly>
      )}
    </Shell>
  );
}
