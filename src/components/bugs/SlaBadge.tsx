import { Badge } from "@/components/ui/badge";
import { slaLabel, slaState, slaTone, type SlaInput } from "@/lib/sla";
import { cn } from "@/lib/utils";

/** Aging indicator for an open bug; renders nothing once the bug is resolved. */
export function SlaBadge({ bug, className }: { bug: SlaInput; className?: string }) {
  const state = slaState(bug);
  if (state === "resolved" || state === "ok") return null;
  const label = slaLabel(bug);
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 text-[10px] font-medium", slaTone(state), className)}
      title={`SLA ${state === "breached" ? "breached" : "at risk"} — ${label}`}
    >
      {state === "breached" ? "SLA " : "Due "}
      {label}
    </Badge>
  );
}
