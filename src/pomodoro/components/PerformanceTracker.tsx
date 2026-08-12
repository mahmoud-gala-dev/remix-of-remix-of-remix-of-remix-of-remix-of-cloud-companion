import { useMemo } from "react";
import { Flame, Target, Timer, TrendingUp } from "lucide-react";
import { pt, type Lang, type LogItem, type TodoItem } from "@/pomodoro/types";

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Streaks, totals, completion rate and a compact 7-day focus bar chart. */
export function PerformanceTracker({
  lang,
  logs,
  todos,
}: {
  lang: Lang;
  logs: LogItem[];
  todos: TodoItem[];
}) {
  const stats = useMemo(() => {
    const focusLogs = logs.filter((log) => log.phase === "focus");
    const minutes = focusLogs.reduce((sum, log) => sum + log.duration, 0);

    const daysWithFocus = new Set(focusLogs.map((log) => dayKey(log.completedAt)));
    let streak = 0;
    const cursor = new Date();
    while (daysWithFocus.has(dayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const done = todos.filter((todo) => todo.completed).length;
    const rate = todos.length > 0 ? Math.round((done / todos.length) * 100) : 0;

    const week: { label: string; minutes: number }[] = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = dayKey(date.getTime());
      week.push({
        label: date.toLocaleDateString(lang === "ar" ? "ar" : "en", { weekday: "narrow" }),
        minutes: focusLogs
          .filter((log) => dayKey(log.completedAt) === key)
          .reduce((sum, log) => sum + log.duration, 0),
      });
    }

    return { sessions: focusLogs.length, minutes, streak, rate, week };
  }, [logs, todos, lang]);

  const peak = Math.max(30, ...stats.week.map((day) => day.minutes));

  return (
    <section className="rounded-2xl p-4 pomo-panel">
      <h2 className="mb-3 text-sm font-semibold">{pt(lang, "performance")}</h2>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={<Timer className="h-4 w-4" />} label={pt(lang, "sessions")} value={stats.sessions} />
        <Stat
          icon={<TrendingUp className="h-4 w-4" />}
          label={pt(lang, "focusMinutes")}
          value={stats.minutes}
        />
        <Stat icon={<Flame className="h-4 w-4" />} label={pt(lang, "streak")} value={stats.streak} />
        <Stat
          icon={<Target className="h-4 w-4" />}
          label={pt(lang, "completionRate")}
          value={`${stats.rate}%`}
        />
      </dl>

      <p className="mt-4 mb-2 text-xs pomo-muted">{pt(lang, "last7Days")}</p>
      <div className="flex h-24 items-end gap-2">
        {stats.week.map((day, index) => (
          <div key={index} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.round((day.minutes / peak) * 100)}%`,
                minHeight: day.minutes > 0 ? 4 : 2,
                background: day.minutes > 0 ? "var(--pomo-accent)" : "var(--pomo-ring)",
              }}
              title={`${day.minutes} ${pt(lang, "minutes")}`}
            />
            <span className="text-[10px] pomo-muted">{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ border: "1px solid var(--pomo-ring)" }}>
      <dt className="flex items-center gap-1.5 text-[11px] pomo-muted">
        <span className="pomo-accent">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
