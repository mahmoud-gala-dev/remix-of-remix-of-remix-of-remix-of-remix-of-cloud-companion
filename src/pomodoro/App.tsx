import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ActiveTimer } from "@/pomodoro/components/ActiveTimer";
import { PerformanceTracker } from "@/pomodoro/components/PerformanceTracker";
import { SessionLogs } from "@/pomodoro/components/SessionLogs";
import { SettingsWidget } from "@/pomodoro/components/SettingsWidget";
import { TodoWidget } from "@/pomodoro/components/TodoWidget";
import { ambientAudio, playCue } from "@/pomodoro/lib/ambientAudio";
import {
  BREAK_AFFIRMATIONS,
  CHECKPOINTS,
  DEFAULT_CATEGORIES,
  INITIAL_SETTINGS,
  QUOTES,
  STORAGE_KEYS,
  formatClock,
  phaseLabel,
  phaseMinutes,
  pt,
  readStored,
  writeStored,
  type AppSettings,
  type Lang,
  type LogItem,
  type PhaseType,
  type TimerState,
  type TodoItem,
} from "@/pomodoro/types";
import "@/pomodoro/index.css";

/**
 * Timestamp-driven Pomodoro. The single source of truth is the target end time
 * in localStorage, so the countdown stays accurate across tab throttling,
 * background tabs and page reloads.
 */
export default function PomodoroApp() {
  const [settings, setSettings] = useState<AppSettings>(() =>
    readStored(STORAGE_KEYS.settings, INITIAL_SETTINGS),
  );
  const [sessionTodos, setSessionTodos] = useState<TodoItem[]>(() =>
    readStored<TodoItem[]>(STORAGE_KEYS.todos, []),
  );
  const [dailyTodos, setDailyTodos] = useState<TodoItem[]>(() =>
    readStored<TodoItem[]>(STORAGE_KEYS.dailyTodos, []),
  );
  const [logs, setLogs] = useState<LogItem[]>(() => readStored<LogItem[]>(STORAGE_KEYS.logs, []));
  const [categories, setCategories] = useState<string[]>(() =>
    readStored<string[]>(STORAGE_KEYS.categories, [...DEFAULT_CATEGORIES]),
  );

  const [phase, setPhase] = useState<PhaseType>(() => readStored(STORAGE_KEYS.phase, "focus"));
  const [state, setState] = useState<TimerState>(() => readStored(STORAGE_KEYS.state, "idle"));
  const [completedSessions, setCompletedSessions] = useState<number>(() =>
    readStored(STORAGE_KEYS.completed, 0),
  );
  const [totalSeconds, setTotalSeconds] = useState<number>(() =>
    readStored(STORAGE_KEYS.total, INITIAL_SETTINGS.focusDuration * 60),
  );
  const [remaining, setRemaining] = useState<number>(totalSeconds);
  const [focusView, setFocusView] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const endTimeRef = useRef<number | null>(readStored<number | null>(STORAGE_KEYS.endTime, null));
  const reachedCheckpoints = useRef<Set<number>>(new Set());
  // The Pomodoro module ships in English only.
  const lang: Lang = "en";

  /* Persist every slice separately so a single corrupt key cannot lose the rest. */
  useEffect(() => writeStored(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => writeStored(STORAGE_KEYS.todos, sessionTodos), [sessionTodos]);
  useEffect(() => writeStored(STORAGE_KEYS.dailyTodos, dailyTodos), [dailyTodos]);
  useEffect(() => writeStored(STORAGE_KEYS.logs, logs), [logs]);
  useEffect(() => writeStored(STORAGE_KEYS.categories, categories), [categories]);
  useEffect(() => writeStored(STORAGE_KEYS.phase, phase), [phase]);
  useEffect(() => writeStored(STORAGE_KEYS.state, state), [state]);
  useEffect(() => writeStored(STORAGE_KEYS.total, totalSeconds), [totalSeconds]);
  useEffect(() => writeStored(STORAGE_KEYS.completed, completedSessions), [completedSessions]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);

  const notify = useCallback(
    (title: string, body: string) => {
      if (!settings.notificationsEnabled) return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      try {
        new Notification(title, { body, tag: "pomodoro-focus" });
      } catch {
        // Some browsers reject constructor notifications; the in-app UI still updates.
      }
    },
    [settings.notificationsEnabled],
  );

  const activeTaskText = useMemo(
    () => sessionTodos.find((todo) => !todo.completed && !todo.archived)?.text,
    [sessionTodos],
  );

  const beginPhase = useCallback(
    (nextPhase: PhaseType, autoStart: boolean) => {
      const seconds = phaseMinutes(settings, nextPhase) * 60;
      reachedCheckpoints.current = new Set();
      setPhase(nextPhase);
      setTotalSeconds(seconds);
      setRemaining(seconds);
      if (autoStart) {
        endTimeRef.current = Date.now() + seconds * 1000;
        writeStored(STORAGE_KEYS.endTime, endTimeRef.current);
        setState("running");
      } else {
        endTimeRef.current = null;
        writeStored(STORAGE_KEYS.endTime, null);
        setState("idle");
      }
    },
    [settings],
  );

  const completePhase = useCallback(() => {
    const minutes = Math.round(totalSeconds / 60);
    setLogs((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        phase,
        duration: minutes,
        completedAt: Date.now(),
        taskText: phase === "focus" ? activeTaskText : undefined,
      },
    ]);
    if (settings.soundEnabled) playCue("complete", settings.volume);
    notify(pt(lang, "phaseComplete", { phase: phaseLabel(lang, phase) }), pt(lang, "appTitle"));

    if (phase === "focus") {
      const nextCount = completedSessions + 1;
      setCompletedSessions(nextCount);
      const longBreakDue = nextCount % settings.sessionsUntilLongBreak === 0;
      beginPhase(longBreakDue ? "longBreak" : "shortBreak", settings.autoStartBreaks);
    } else {
      beginPhase("focus", settings.autoStartFocus);
    }
  }, [
    activeTaskText,
    beginPhase,
    completedSessions,
    lang,
    notify,
    phase,
    settings.autoStartBreaks,
    settings.autoStartFocus,
    settings.sessionsUntilLongBreak,
    settings.soundEnabled,
    settings.volume,
    totalSeconds,
  ]);

  /* One shared tick reads the wall clock, so drift never accumulates. */
  useEffect(() => {
    if (state !== "running") return;
    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + remaining * 1000;
      writeStored(STORAGE_KEYS.endTime, endTimeRef.current);
    }
    const interval = window.setInterval(() => {
      const target = endTimeRef.current;
      if (target === null) return;
      const left = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(left);

      const elapsedPercent = totalSeconds > 0 ? ((totalSeconds - left) / totalSeconds) * 100 : 0;
      for (const checkpoint of CHECKPOINTS) {
        if (checkpoint < 100 && elapsedPercent >= checkpoint && !reachedCheckpoints.current.has(checkpoint)) {
          reachedCheckpoints.current.add(checkpoint);
          if (settings.soundEnabled) playCue("checkpoint", settings.volume * 0.6);
        }
      }
      if (left === 0) completePhase();
    }, 500);
    return () => window.clearInterval(interval);
  }, [state, remaining, totalSeconds, settings.soundEnabled, settings.volume, completePhase]);

  /* Recompute the remaining time whenever the tab regains focus. */
  useEffect(() => {
    function sync() {
      if (state !== "running" || endTimeRef.current === null) return;
      setRemaining(Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000)));
    }
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, [state]);

  useEffect(() => {
    document.title = `${formatClock(remaining)} · ${phaseLabel(lang, phase)} — ${pt(lang, "appTitle")}`;
  }, [remaining, phase, lang]);

  /* Ambient audio only plays while a phase is actually running. */
  useEffect(() => {
    if (state === "running" && settings.ambientSound !== "none") {
      ambientAudio.play(settings.ambientSound, settings.volume);
    } else {
      ambientAudio.stop();
    }
    return () => ambientAudio.stop();
  }, [state, settings.ambientSound, settings.volume]);

  useEffect(() => {
    const rotate = window.setInterval(() => setQuoteIndex((index) => index + 1), 30_000);
    return () => window.clearInterval(rotate);
  }, []);

  const toggleTimer = useCallback(() => {
    if (state === "running") {
      setState("paused");
      endTimeRef.current = null;
      writeStored(STORAGE_KEYS.endTime, null);
      if (settings.soundEnabled) playCue("pause", settings.volume);
      return;
    }
    endTimeRef.current = Date.now() + (remaining > 0 ? remaining : totalSeconds) * 1000;
    writeStored(STORAGE_KEYS.endTime, endTimeRef.current);
    setState("running");
    if (settings.soundEnabled) playCue(state === "paused" ? "resume" : "start", settings.volume);
  }, [remaining, settings.soundEnabled, settings.volume, state, totalSeconds]);

  const resetTimer = useCallback(() => beginPhase(phase, false), [beginPhase, phase]);
  const skipPhase = useCallback(() => {
    if (phase === "focus") beginPhase("shortBreak", settings.autoStartBreaks);
    else beginPhase("focus", settings.autoStartFocus);
  }, [beginPhase, phase, settings.autoStartBreaks, settings.autoStartFocus]);

  /* Keep the timer length in sync when the user edits durations while idle. */
  useEffect(() => {
    if (state !== "idle") return;
    const seconds = phaseMinutes(settings, phase) * 60;
    setTotalSeconds(seconds);
    setRemaining(seconds);
  }, [settings, phase, state]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleTimer();
      } else if (event.key.toLowerCase() === "r") resetTimer();
      else if (event.key.toLowerCase() === "s") skipPhase();
      else if (event.key.toLowerCase() === "f") setFocusView((value) => !value);
      else if (event.key === "Escape") setFocusView(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetTimer, skipPhase, toggleTimer]);

  const quote = useMemo(() => {
    const pool = phase === "focus" ? QUOTES[lang] : BREAK_AFFIRMATIONS[lang];
    return pool[quoteIndex % pool.length] ?? "";
  }, [phase, lang, quoteIndex]);

  const timer = (
    <ActiveTimer
      lang={lang}
      phase={phase}
      state={state}
      remaining={remaining}
      total={totalSeconds}
      quote={quote}
      completedSessions={completedSessions}
      onToggle={toggleTimer}
      onReset={resetTimer}
      onSkip={skipPhase}
      {...(focusView ? {} : { onFullscreen: () => setFocusView(true) })}
      compact={focusView}
    />
  );

  return (
    <div
      dir="ltr"
      className={`pomodoro-root theme-${settings.theme} min-h-full rounded-2xl p-3 sm:p-6`}
    >
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{pt(lang, "appTitle")}</h1>
        <span className="text-xs pomo-muted">
          {phaseLabel(lang, phase)} · {formatClock(remaining)}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl p-4 sm:p-6 pomo-panel">{timer}</div>
          <PerformanceTracker lang={lang} logs={logs} todos={[...sessionTodos, ...dailyTodos]} />
          <SessionLogs lang={lang} logs={logs} onClear={() => setLogs([])} />
        </div>

        <div className="flex flex-col gap-4">
          <TodoWidget
            lang={lang}
            title={pt(lang, "sessionGoals")}
            items={sessionTodos}
            categories={categories}
            onChange={setSessionTodos}
          />
          <TodoWidget
            lang={lang}
            title={pt(lang, "dailyTasks")}
            items={dailyTodos}
            categories={categories}
            showCategories
            onAddCategory={(name) =>
              setCategories((current) => (current.includes(name) ? current : [...current, name]))
            }
            onChange={setDailyTodos}
          />
          <SettingsWidget
            lang={lang}
            settings={settings}
            notificationPermission={notificationPermission}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
            onRequestNotifications={async () => {
              if (typeof Notification === "undefined") return;
              const permission = await Notification.requestPermission();
              setNotificationPermission(permission);
              setSettings((current) => ({
                ...current,
                notificationsEnabled: permission === "granted",
              }));
            }}
          />
        </div>
      </div>

      {focusView && (
        <div className={`pomo-focus-view theme-${settings.theme} pomodoro-root`} dir="ltr">
          <button
            type="button"
            onClick={() => setFocusView(false)}
            aria-label={pt(lang, "exitFullscreen")}
            className="absolute top-6 rounded-full border p-2"
            style={{ borderColor: "var(--pomo-ring)", insetInlineEnd: 24 }}
          >
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          </button>
          {timer}
        </div>
      )}
    </div>
  );
}
