import { Bell, Keyboard } from "lucide-react";
import { ambientAudio, playCue } from "@/pomodoro/lib/ambientAudio";
import {
  pt,
  type AmbientSound,
  type AppSettings,
  type Lang,
  type ThemeName,
} from "@/pomodoro/types";

const THEMES: ThemeName[] = ["slate", "aurora", "forest", "retro"];
const AMBIENTS: AmbientSound[] = ["none", "white", "brown", "rain"];

/** All user preferences: durations, automation, audio, theme, language, alerts. */
export function SettingsWidget({
  lang,
  settings,
  onChange,
  notificationPermission,
  onRequestNotifications,
}: {
  lang: Lang;
  settings: AppSettings;
  onChange: (next: Partial<AppSettings>) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onRequestNotifications: () => void;
}) {
  return (
    <section className="rounded-2xl p-4 pomo-panel">
      <h2 className="mb-3 text-sm font-semibold">{pt(lang, "settings")}</h2>

      <p className="mb-2 text-xs pomo-muted">{pt(lang, "durations")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberField
          label={pt(lang, "focus")}
          value={settings.focusDuration}
          min={1}
          max={180}
          onChange={(focusDuration) => onChange({ focusDuration })}
        />
        <NumberField
          label={pt(lang, "shortBreak")}
          value={settings.shortBreakDuration}
          min={1}
          max={60}
          onChange={(shortBreakDuration) => onChange({ shortBreakDuration })}
        />
        <NumberField
          label={pt(lang, "longBreak")}
          value={settings.longBreakDuration}
          min={1}
          max={90}
          onChange={(longBreakDuration) => onChange({ longBreakDuration })}
        />
        <NumberField
          label={pt(lang, "sessionsUntilLongBreak")}
          value={settings.sessionsUntilLongBreak}
          min={1}
          max={12}
          onChange={(sessionsUntilLongBreak) => onChange({ sessionsUntilLongBreak })}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Toggle
          label={pt(lang, "autoStartBreaks")}
          checked={settings.autoStartBreaks}
          onChange={(autoStartBreaks) => onChange({ autoStartBreaks })}
        />
        <Toggle
          label={pt(lang, "autoStartFocus")}
          checked={settings.autoStartFocus}
          onChange={(autoStartFocus) => onChange({ autoStartFocus })}
        />
        <Toggle
          label={pt(lang, "sound")}
          checked={settings.soundEnabled}
          onChange={(soundEnabled) => {
            onChange({ soundEnabled });
            if (soundEnabled) playCue("start", settings.volume);
          }}
        />
      </div>

      <label className="mt-4 block text-xs pomo-muted">
        {pt(lang, "volume")}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={(event) => {
            const volume = Number(event.target.value);
            onChange({ volume });
            ambientAudio.setVolume(volume);
          }}
          className="mt-1 w-full accent-current"
        />
      </label>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SelectField
          label={pt(lang, "ambient")}
          value={settings.ambientSound}
          options={AMBIENTS.map((value) => ({
            value,
            label: pt(
              lang,
              value === "none"
                ? "ambientNone"
                : value === "white"
                  ? "ambientWhite"
                  : value === "brown"
                    ? "ambientBrown"
                    : "ambientRain",
            ),
          }))}
          onChange={(value) => onChange({ ambientSound: value as AmbientSound })}
        />
        <SelectField
          label={pt(lang, "theme")}
          value={settings.theme}
          options={THEMES.map((value) => ({ value, label: value }))}
          onChange={(value) => onChange({ theme: value as ThemeName })}
        />
        <SelectField
          label={pt(lang, "language")}
          value={settings.lang}
          options={[
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
          ]}
          onChange={(value) => onChange({ lang: value as Lang })}
        />
      </div>

      <div className="mt-4 rounded-xl px-3 py-2" style={{ border: "1px solid var(--pomo-ring)" }}>
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <Bell className="h-3.5 w-3.5" aria-hidden="true" />
          {pt(lang, "notifications")}
        </p>
        <p className="mt-1 text-xs pomo-muted">
          {notificationPermission === "granted"
            ? pt(lang, "notificationsGranted")
            : notificationPermission === "denied"
              ? pt(lang, "notificationsDenied")
              : pt(lang, "notificationsDefault")}
        </p>
        {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
          <button
            type="button"
            onClick={onRequestNotifications}
            className="mt-2 rounded-lg px-3 py-1.5 text-xs pomo-accent-bg"
          >
            {pt(lang, "enableNotifications")}
          </button>
        )}
      </div>

      <div className="mt-4 rounded-xl px-3 py-2 text-xs" style={{ border: "1px solid var(--pomo-ring)" }}>
        <p className="flex items-center gap-1.5 font-medium">
          <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
          {pt(lang, "shortcuts")}
        </p>
        <ul className="mt-1 space-y-0.5 pomo-muted">
          <li>Space — {pt(lang, "shortcutStart")}</li>
          <li>R — {pt(lang, "shortcutReset")}</li>
          <li>S — {pt(lang, "shortcutSkip")}</li>
          <li>F — {pt(lang, "shortcutFullscreen")}</li>
        </ul>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[11px] pomo-muted">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))));
        }}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm pomo-field"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-[11px] pomo-muted">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm pomo-field"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ background: checked ? "var(--pomo-accent)" : "var(--pomo-ring)" }}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
          style={{ insetInlineStart: checked ? 18 : 2 }}
        />
      </button>
    </label>
  );
}
