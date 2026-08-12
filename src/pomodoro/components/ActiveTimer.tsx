import { Maximize2, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { formatClock, phaseLabel, pt, type Lang, type PhaseType, type TimerState } from "@/pomodoro/types";

/** Animated ring, clock, phase name, motivational line and transport controls. */
export function ActiveTimer({
  lang,
  phase,
  state,
  remaining,
  total,
  quote,
  completedSessions,
  onToggle,
  onReset,
  onSkip,
  onFullscreen,
  compact = false,
}: {
  lang: Lang;
  phase: PhaseType;
  state: TimerState;
  remaining: number;
  total: number;
  quote: string;
  completedSessions: number;
  onToggle: () => void;
  onReset: () => void;
  onSkip: () => void;
  onFullscreen?: () => void;
  compact?: boolean;
}) {
  const progress = total > 0 ? 1 - remaining / total : 0;
  const size = compact ? 320 : 240;
  const stroke = compact ? 14 : 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-medium uppercase tracking-[0.2em] pomo-accent">
        {phaseLabel(lang, phase)}
      </p>

      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--pomo-ring)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--pomo-accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.4s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-5xl font-semibold tabular-nums">
            {formatClock(remaining)}
          </span>
          <span className="mt-1 text-xs pomo-muted">
            {pt(lang, "sessions")}: {completedSessions}
          </span>
        </div>
      </div>

      <p className="max-w-xs text-center text-sm pomo-muted">{quote}</p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold pomo-accent-bg"
        >
          {state === "running" ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {state === "running"
            ? pt(lang, "pause")
            : state === "paused"
              ? pt(lang, "resume")
              : pt(lang, "start")}
        </button>
        <button
          type="button"
          onClick={onReset}
          aria-label={pt(lang, "reset")}
          className="rounded-full border p-2.5"
          style={{ borderColor: "var(--pomo-ring)" }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSkip}
          aria-label={pt(lang, "skip")}
          className="rounded-full border p-2.5"
          style={{ borderColor: "var(--pomo-ring)" }}
        >
          <SkipForward className="h-4 w-4" aria-hidden="true" />
        </button>
        {onFullscreen && (
          <button
            type="button"
            onClick={onFullscreen}
            aria-label={pt(lang, "fullscreen")}
            className="rounded-full border p-2.5"
            style={{ borderColor: "var(--pomo-ring)" }}
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
