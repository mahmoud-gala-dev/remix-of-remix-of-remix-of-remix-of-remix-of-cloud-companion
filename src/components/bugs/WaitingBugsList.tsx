import { useCallback, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, ExternalLink, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import {
  clearWaitingBugs,
  getWaitingBugs,
  removeWaitingBug,
  type WaitingBug,
} from "@/lib/waiting-bugs";

interface WaitingBugsListProps {
  /**
   * When true the component reads from localStorage on every render (via a
   * local refresh counter). Pass an external refresh signal if the parent needs
   * to trigger a re-read after adding a bug.
   */
  refreshSignal?: number;
  /** Maximum items to show before "show all" is offered. Defaults to 6. */
  maxVisible?: number;
}

/**
 * Displays the user's personal "waiting" bug list — bugs they deferred while
 * working through the bug-detail workflow. Stored in localStorage, never on the
 * server, so changes are instant and private to this browser session.
 */
export function WaitingBugsList({
  refreshSignal = 0,
  maxVisible = 6,
}: WaitingBugsListProps) {
  const { t } = useI18n();
  // Local counter so individual removes immediately re-render the list.
  const [revision, setRevision] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-read storage on every external signal
  const bugs = useMemo<WaitingBug[]>(
    () => getWaitingBugs(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revision, refreshSignal],
  );

  const visible = showAll ? bugs : bugs.slice(0, maxVisible);
  const overflow = bugs.length - maxVisible;

  const handleRemove = useCallback(
    (bugDbId: number, bugDisplayId: string) => {
      removeWaitingBug(bugDbId);
      toast.success(t("bug.wait.removed"), { description: bugDisplayId });
      setRevision((r) => r + 1);
    },
    [t],
  );

  const handleClearAll = useCallback(() => {
    clearWaitingBugs();
    toast.success(t("bug.waiting.clear"));
    setRevision((r) => r + 1);
  }, [t]);

  if (bugs.length === 0) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-warning" />
            {t("bug.waiting.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("bug.waiting.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-warning" />
            {t("bug.waiting.title")}
            <Badge
              variant="outline"
              className="border-warning/40 text-warning text-[10px]"
            >
              {bugs.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClearAll}
          >
            <Trash2 className="me-1 h-3 w-3" />
            {t("bug.waiting.clear")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((bug) => (
          <WaitingBugRow key={bug.id} bug={bug} onRemove={handleRemove} />
        ))}

        {overflow > 0 && !showAll && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowAll(true)}
          >
            + {overflow} more
          </Button>
        )}
        {showAll && overflow > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setShowAll(false)}
          >
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Row sub-component (keeps the parent render clean) ─────────────────────────

function WaitingBugRow({
  bug,
  onRemove,
}: {
  bug: WaitingBug;
  onRemove: (id: number, bugId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="group flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 transition-colors hover:border-warning/40 hover:bg-warning/5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
            {bug.bugId}
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {bug.title}
          </span>
        </div>
        <span className="mt-0.5 block text-[11px] text-muted-foreground/70">
          {new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(bug.addedAt))}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={t("bug.waiting.open")}
        >
          <Link to="/bugs/$id" params={{ id: String(bug.id) }}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:text-destructive"
          title={t("bug.waiting.remove")}
          onClick={() => onRemove(bug.id, bug.bugId)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
