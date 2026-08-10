import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statusTone, priorityTone } from "@/lib/api";

export function formatRelativeTime(value: string) {
  const date = new Date(value);
  const delta = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  toneClass,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  toneClass?: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="flex items-start justify-between gap-2 pt-5 pb-4 px-5">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`mt-1 text-3xl font-bold ${toneClass ?? "text-foreground"}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-xl bg-muted/60 p-2.5">
          <Icon className={`h-5 w-5 ${toneClass ?? "text-foreground"}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/40 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export function BugLink({
  id,
  code,
  title,
  status,
  priority,
}: {
  id: number;
  code: string;
  title: string;
  status?: string;
  priority?: string;
}) {
  return (
    <Link
      to="/bugs/$id"
      params={{ id: String(id) }}
      className="group flex items-start gap-3 rounded-md px-2 py-3 transition-colors hover:bg-accent/55"
    >
      {priority && (
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
            priority === "High" || priority === "Critical"
              ? "bg-destructive"
              : priority === "Medium"
                ? "bg-warning"
                : "bg-success"
          }`}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-semibold tracking-wide text-primary">
            {code}
          </span>
          {status && (
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider ${statusTone(status)}`}
            >
              {status}
            </Badge>
          )}
        </span>
        <span className="mt-1 block truncate text-sm font-medium group-hover:text-primary">
          {title}
        </span>
      </span>
      <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6" aria-label="Loading dashboard">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1, 2].map((item) => (
          <Skeleton key={item} className="h-72 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export { statusTone, priorityTone };
