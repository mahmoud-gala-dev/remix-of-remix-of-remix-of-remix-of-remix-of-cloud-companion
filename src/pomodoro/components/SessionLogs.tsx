import { Download, Trash2 } from "lucide-react";
import { phaseLabel, pt, type Lang, type LogItem } from "@/pomodoro/types";

/** Chronological session history with CSV export. */
export function SessionLogs({
  lang,
  logs,
  onClear,
}: {
  lang: Lang;
  logs: LogItem[];
  onClear: () => void;
}) {
  function exportCsv() {
    const header = "phase,minutes,completed_at,task\n";
    const body = logs
      .map(
        (log) =>
          `${log.phase},${log.duration},${new Date(log.completedAt).toISOString()},"${(log.taskText ?? "").replaceAll('"', "'")}"`,
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pomodoro-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-2xl p-4 pomo-panel">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{pt(lang, "logs")}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs disabled:opacity-50"
            style={{ border: "1px solid var(--pomo-ring)" }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {pt(lang, "exportLogs")}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={logs.length === 0}
            aria-label={pt(lang, "clearLogs")}
            className="rounded-lg p-1.5 disabled:opacity-50"
            style={{ border: "1px solid var(--pomo-ring)" }}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {logs.length === 0 ? (
        <p className="text-xs pomo-muted">{pt(lang, "noLogs")}</p>
      ) : (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto pe-1">
          {[...logs]
            .sort((a, b) => b.completedAt - a.completedAt)
            .map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ border: "1px solid var(--pomo-ring)" }}
              >
                <span className="font-medium">{phaseLabel(lang, log.phase)}</span>
                <span className="pomo-muted">
                  {log.duration} {pt(lang, "minutes")}
                </span>
                <span className="pomo-muted">
                  {new Date(log.completedAt).toLocaleTimeString(lang === "ar" ? "ar" : "en", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
