/**
 * SLA aging for open bugs: how long a bug has been waiting versus the target
 * response time for its priority, in hours.
 */
export type SlaState = "resolved" | "ok" | "at-risk" | "breached";

export const RESOLVED_STATUSES = ["Fixed", "Closed"];

/** Target resolution window per priority, in hours. */
export const SLA_TARGET_HOURS: Record<string, number> = {
  Critical: 8,
  High: 24,
  Medium: 72,
  Low: 168,
};

export const DEFAULT_SLA_HOURS = 72;

export function slaTargetHours(priority: string | null | undefined) {
  return SLA_TARGET_HOURS[priority ?? ""] ?? DEFAULT_SLA_HOURS;
}

export function ageHours(createdAt: string | null | undefined, now: Date = new Date()) {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (now.getTime() - created) / 3_600_000);
}

export type SlaInput = {
  status: string;
  priority: string;
  created_at: string;
};

/** Bugs past their target are breached; past 75% of it they are at risk. */
export function slaState(bug: SlaInput, now: Date = new Date()): SlaState {
  if (RESOLVED_STATUSES.includes(bug.status)) return "resolved";
  const target = slaTargetHours(bug.priority);
  const age = ageHours(bug.created_at, now);
  if (age >= target) return "breached";
  if (age >= target * 0.75) return "at-risk";
  return "ok";
}

/** Short human label such as "3h overdue" or "5h left". */
export function slaLabel(bug: SlaInput, now: Date = new Date()) {
  const target = slaTargetHours(bug.priority);
  const age = ageHours(bug.created_at, now);
  const delta = Math.round(Math.abs(target - age));
  const unit = (value: number) => (value >= 48 ? `${Math.round(value / 24)}d` : `${value}h`);
  return age >= target ? `${unit(delta)} overdue` : `${unit(delta)} left`;
}

export function slaTone(state: SlaState) {
  if (state === "breached") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (state === "at-risk") return "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return "border-border text-muted-foreground";
}

/** Counts of at-risk and breached bugs in a list. */
export function slaSummary(bugs: SlaInput[], now: Date = new Date()) {
  let atRisk = 0;
  let breached = 0;
  for (const bug of bugs) {
    const state = slaState(bug, now);
    if (state === "at-risk") atRisk += 1;
    else if (state === "breached") breached += 1;
  }
  return { atRisk, breached };
}
