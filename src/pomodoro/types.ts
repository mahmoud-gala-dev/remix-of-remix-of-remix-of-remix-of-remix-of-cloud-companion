/**
 * Pomodoro Focus — shared types, defaults and the module's own bilingual
 * dictionary. Everything here is pure data so it is safe to import anywhere.
 */

export type PhaseType = "focus" | "shortBreak" | "longBreak";
export type TimerState = "idle" | "running" | "paused";
export type Priority = "high" | "medium" | "low";
export type ThemeName = "slate" | "aurora" | "forest" | "retro";
export type Lang = "en" | "ar";
export type AmbientSound = "none" | "white" | "brown" | "rain";

export type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  archived?: boolean;
  category?: string;
  priority?: Priority;
};

export type LogItem = {
  id: string;
  phase: PhaseType;
  /** Completed length in minutes. */
  duration: number;
  completedAt: number;
  taskText?: string;
};

export type AppSettings = {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  volume: number;
  notificationsEnabled: boolean;
  ambientSound: AmbientSound;
  theme: ThemeName;
  lang: Lang;
};

export const INITIAL_SETTINGS: AppSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  soundEnabled: true,
  volume: 0.5,
  notificationsEnabled: false,
  ambientSound: "none",
  theme: "slate",
  lang: "ar",
};

export const STORAGE_KEYS = {
  settings: "pomodoro_settings",
  todos: "pomodoro_todos",
  dailyTodos: "pomodoro_daily_todos",
  logs: "pomodoro_logs",
  categories: "pomodoro_categories",
  endTime: "pomodoro_active_endtime",
  state: "pomodoro_active_state",
  phase: "pomodoro_active_phase",
  total: "pomodoro_active_total",
  completed: "pomodoro_completed_sessions",
} as const;

export const DEFAULT_CATEGORIES = ["general", "work", "study", "personal"] as const;

export const QUOTES: Record<Lang, string[]> = {
  en: [
    "Deep work beats long work.",
    "One task. One timer. One win.",
    "Small sessions compound into big shipping.",
    "Protect the next 25 minutes.",
    "Momentum is built, not found.",
  ],
  ar: [
    "التركيز العميق أفضل من العمل الطويل.",
    "مهمة واحدة، مؤقّت واحد، إنجاز واحد.",
    "الجلسات الصغيرة تتراكم إلى إنجاز كبير.",
    "احمِ الخمس والعشرين دقيقة القادمة.",
    "الزخم يُبنى ولا يُنتظر.",
  ],
};

export const BREAK_AFFIRMATIONS: Record<Lang, string[]> = {
  en: ["Stand up and stretch.", "Look away from the screen.", "Drink some water.", "Breathe slowly."],
  ar: ["قِف وتمدّد قليلًا.", "أرِح عينيك عن الشاشة.", "اشرب بعض الماء.", "تنفّس ببطء."],
};

export const TRANSLATIONS = {
  en: {
    appTitle: "Pomodoro Focus",
    focus: "Focus",
    shortBreak: "Short break",
    longBreak: "Long break",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    skip: "Skip",
    fullscreen: "Focus view",
    exitFullscreen: "Exit focus view",
    sessionGoals: "Session goals",
    dailyTasks: "Today's tasks",
    addTask: "Add a task…",
    voiceInput: "Voice input",
    sortBy: "Sort",
    sortPriority: "Priority",
    sortAlpha: "A–Z",
    sortStatus: "Status",
    sortNewest: "Newest",
    filterAll: "All",
    filterActive: "Active",
    filterDone: "Done",
    archive: "Archive",
    archived: "Archived",
    category: "Category",
    newCategory: "New category",
    priority: "Priority",
    performance: "Performance",
    sessions: "Sessions",
    focusMinutes: "Focus minutes",
    streak: "Day streak",
    completionRate: "Completion rate",
    last7Days: "Last 7 days",
    logs: "Session log",
    exportLogs: "Export",
    clearLogs: "Clear log",
    noLogs: "No sessions logged yet.",
    settings: "Settings",
    durations: "Durations (minutes)",
    sessionsUntilLongBreak: "Sessions until long break",
    autoStartBreaks: "Auto-start breaks",
    autoStartFocus: "Auto-start focus",
    sound: "Sound effects",
    volume: "Volume",
    ambient: "Ambient sound",
    ambientNone: "Off",
    ambientWhite: "White noise",
    ambientBrown: "Brown noise",
    ambientRain: "Rain",
    theme: "Theme",
    language: "Language",
    notifications: "Notifications",
    notificationsGranted: "Notifications enabled",
    notificationsDenied: "Notifications blocked in the browser",
    notificationsDefault: "Notifications not requested yet",
    enableNotifications: "Enable notifications",
    testNotification: "Send a test",
    shortcuts: "Keyboard shortcuts",
    shortcutStart: "Start / pause",
    shortcutReset: "Reset timer",
    shortcutSkip: "Skip phase",
    shortcutFullscreen: "Focus view",
    shortcutHelp: "Show shortcuts",
    checkpoint: "{percent}% of your {phase} session is done",
    phaseComplete: "{phase} complete",
    minutes: "min",
    delete: "Delete",
    close: "Close",
    empty: "Nothing here yet.",
  },
  ar: {
    appTitle: "بومودورو للتركيز",
    focus: "تركيز",
    shortBreak: "راحة قصيرة",
    longBreak: "راحة طويلة",
    start: "ابدأ",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    reset: "إعادة",
    skip: "تخطٍ",
    fullscreen: "وضع التركيز",
    exitFullscreen: "خروج من وضع التركيز",
    sessionGoals: "أهداف الجلسة",
    dailyTasks: "مهام اليوم",
    addTask: "أضف مهمة…",
    voiceInput: "إدخال صوتي",
    sortBy: "فرز",
    sortPriority: "الأولوية",
    sortAlpha: "أبجدي",
    sortStatus: "الحالة",
    sortNewest: "الأحدث",
    filterAll: "الكل",
    filterActive: "غير منجزة",
    filterDone: "منجزة",
    archive: "أرشفة",
    archived: "المؤرشفة",
    category: "التصنيف",
    newCategory: "تصنيف جديد",
    priority: "الأولوية",
    performance: "الأداء",
    sessions: "الجلسات",
    focusMinutes: "دقائق التركيز",
    streak: "أيام متتابعة",
    completionRate: "نسبة الإنجاز",
    last7Days: "آخر ٧ أيام",
    logs: "سجل الجلسات",
    exportLogs: "تصدير",
    clearLogs: "تفريغ السجل",
    noLogs: "لا توجد جلسات مسجّلة بعد.",
    settings: "الإعدادات",
    durations: "المُدد (دقائق)",
    sessionsUntilLongBreak: "عدد الجلسات قبل الراحة الطويلة",
    autoStartBreaks: "بدء الراحة تلقائيًا",
    autoStartFocus: "بدء التركيز تلقائيًا",
    sound: "المؤثرات الصوتية",
    volume: "مستوى الصوت",
    ambient: "الصوت المحيط",
    ambientNone: "بدون",
    ambientWhite: "ضوضاء بيضاء",
    ambientBrown: "ضوضاء بنية",
    ambientRain: "مطر",
    theme: "الثيم",
    language: "اللغة",
    notifications: "الإشعارات",
    notificationsGranted: "الإشعارات مُفعّلة",
    notificationsDenied: "الإشعارات محجوبة من المتصفح",
    notificationsDefault: "لم يُطلب إذن الإشعارات بعد",
    enableNotifications: "تفعيل الإشعارات",
    testNotification: "إشعار تجريبي",
    shortcuts: "اختصارات لوحة المفاتيح",
    shortcutStart: "تشغيل / إيقاف",
    shortcutReset: "إعادة المؤقّت",
    shortcutSkip: "تخطي الطور",
    shortcutFullscreen: "وضع التركيز",
    shortcutHelp: "عرض الاختصارات",
    checkpoint: "أكملت {percent}% من جلسة {phase}",
    phaseComplete: "انتهت {phase}",
    minutes: "دقيقة",
    delete: "حذف",
    close: "إغلاق",
    empty: "لا يوجد شيء بعد.",
  },
} as const;

export type PomodoroKey = keyof (typeof TRANSLATIONS)["en"];

/** Tiny translator with `{token}` interpolation, scoped to this module. */
export function pt(lang: Lang, key: PomodoroKey, vars?: Record<string, string | number>) {
  let value: string = TRANSLATIONS[lang][key] ?? TRANSLATIONS.en[key] ?? key;
  if (vars) {
    for (const [token, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${token}}`, String(replacement));
    }
  }
  return value;
}

export function phaseLabel(lang: Lang, phase: PhaseType) {
  return pt(lang, phase === "focus" ? "focus" : phase === "shortBreak" ? "shortBreak" : "longBreak");
}

export function phaseMinutes(settings: AppSettings, phase: PhaseType) {
  if (phase === "focus") return settings.focusDuration;
  if (phase === "shortBreak") return settings.shortBreakDuration;
  return settings.longBreakDuration;
}

/** Reads JSON from localStorage, falling back to `fallback` on any problem. */
export function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or a full quota simply means this session is not persisted.
  }
}

export function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export const CHECKPOINTS = [25, 50, 75, 100] as const;
