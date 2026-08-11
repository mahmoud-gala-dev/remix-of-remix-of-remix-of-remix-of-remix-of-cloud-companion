import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ar";

export const LANGUAGE_KEY = "electropi.language";

/**
 * Flat dictionary keyed by dotted string. Arabic must cover every English key —
 * `src/lib/i18n.test.ts` fails the build when a key is missing.
 */
export const dictionaries = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.myWork": "My Work",
    "nav.bugs": "Bugs",
    "nav.compare": "Compare Excel",
    "nav.tasks": "Priority Tasks",
    "nav.projects": "Projects",
    "nav.chat": "Team Chat",
    "nav.activity": "Activity Feed",
    "nav.resolutionTimes": "Resolution Times",
    "nav.analytics": "Analytics",
    "nav.reports": "Reports",
    "nav.users": "Users",
    "nav.settings": "Settings",
    "mobile.home": "Home",
    "mobile.bugs": "Bugs",
    "mobile.tasks": "Tasks",
    "mobile.chat": "Chat",
    "mobile.projects": "Projects",
    "mobile.more": "More",
    "shell.main": "Main",
    "shell.primaryMobile": "Primary mobile",
    "shell.openMenu": "Open navigation menu",
    "shell.signOut": "Sign out",
    "shell.notifications": "Notifications",
    "shell.notificationsUnread": "Notifications, {count} unread",
    "shell.userAvatar": "User Avatar",
    "language.label": "Language",
    "language.english": "English",
    "language.arabic": "العربية",
    "language.switchTo": "Switch to Arabic",
    "common.refresh": "Refresh",
    "common.someone": "Someone",
    "activity.title": "Activity feed",
    "activity.description":
      "Bug updates, comments and chat messages you have access to, newest first.",
    "activity.empty":
      "Nothing has happened yet. Activity appears once bugs are updated or messages are sent.",
    "activity.kind.history": "Bug update",
    "activity.kind.comment": "Comment",
    "activity.kind.chat": "Chat",
    "activity.openBug": "Open bug",
    "activity.openChat": "Open chat",
    "resolution.title": "Resolution Times",
    "resolution.subtitleAll":
      "Total time developers logged while fixing errors, ranked from the highest.",
    "resolution.subtitleOwn":
      "Your own logged resolution time. Use the timer on a bug page to record work.",
    "resolution.totalLogged": "Total logged",
    "resolution.developersTracked": "Developers tracked",
    "resolution.highestTime": "Highest time",
    "resolution.leaderboard": "Developer leaderboard",
    "resolution.empty": "No resolution time logged yet.",
    "resolution.perBug": "Per-bug breakdown",
    "resolution.perBugEmpty": "Nothing logged yet.",
    "resolution.col.developer": "Developer",
    "resolution.col.role": "Role",
    "resolution.col.bugs": "Bugs",
    "resolution.col.totalTime": "Total time",
    "resolution.col.bug": "Bug",
    "resolution.col.title": "Title",
    "resolution.col.module": "Module",
    "resolution.col.time": "Time",

  ar: {
    "nav.dashboard": "لوحة التحكم",
    "nav.myWork": "مهامي",
    "nav.bugs": "الأخطاء",
    "nav.compare": "مقارنة إكسل",
    "nav.tasks": "المهام ذات الأولوية",
    "nav.projects": "المشاريع",
    "nav.chat": "شات الفريق",
    "nav.activity": "سجل النشاط",
    "nav.resolutionTimes": "أوقات الحل",
    "nav.analytics": "التحليلات",
    "nav.reports": "التقارير",
    "nav.users": "المستخدمون",
    "nav.settings": "الإعدادات",
    "mobile.home": "الرئيسية",
    "mobile.bugs": "الأخطاء",
    "mobile.tasks": "المهام",
    "mobile.chat": "الشات",
    "mobile.projects": "المشاريع",
    "mobile.more": "المزيد",
    "shell.main": "القائمة الرئيسية",
    "shell.primaryMobile": "قائمة الجوال",
    "shell.openMenu": "فتح قائمة التنقل",
    "shell.signOut": "تسجيل الخروج",
    "shell.notifications": "الإشعارات",
    "shell.notificationsUnread": "الإشعارات، {count} غير مقروء",
    "shell.userAvatar": "صورة المستخدم",
    "language.label": "اللغة",
    "language.english": "English",
    "language.arabic": "العربية",
    "language.switchTo": "التبديل إلى الإنجليزية",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.en;

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ar";
}

export function directionFor(language: Language) {
  return language === "ar" ? "rtl" : "ltr";
}

/** Looks a key up, filling `{name}` placeholders and falling back to English. */
export function translate(
  language: Language,
  key: TranslationKey,
  vars?: Record<string, string | number>,
) {
  const table = dictionaries[language] as Record<string, string>;
  const raw = table[key] ?? (dictionaries.en as Record<string, string>)[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

type LanguageContextValue = {
  language: Language;
  direction: "ltr" | "rtl";
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  /* Read the stored choice after hydration so SSR and the first client render match. */
  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (isLanguage(stored)) setLanguageState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = directionFor(language);
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      /* private browsing — the choice simply won't persist */
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction: directionFor(language),
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
      t: (key, vars) => translate(language, key, vars),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    /* Safe default so components render outside the provider (tests, storybook). */
    return {
      language: "en" as Language,
      direction: "ltr" as const,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: TranslationKey, vars?: Record<string, string | number>) =>
        translate("en", key, vars),
    };
  }
  return context;
}
