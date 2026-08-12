import { useMemo, useRef, useState } from "react";
import { Archive, Check, Mic, Plus, Trash2 } from "lucide-react";
import {
  pt,
  type Lang,
  type Priority,
  type TodoItem,
} from "@/pomodoro/types";

type SortMode = "priority" | "alpha" | "status" | "newest";
type FilterMode = "all" | "active" | "done";

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#4ade80",
};

/** Task list used both for session goals and for the daily to-do list. */
export function TodoWidget({
  lang,
  title,
  items,
  categories,
  onChange,
  onAddCategory,
  showCategories = false,
}: {
  lang: Lang;
  title: string;
  items: TodoItem[];
  categories: string[];
  onChange: (next: TodoItem[]) => void;
  onAddCategory?: (name: string) => void;
  showCategories?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [category, setCategory] = useState(categories[0] ?? "general");
  const [sort, setSort] = useState<SortMode>("priority");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const visible = useMemo(() => {
    const list = items.filter((item) => Boolean(item.archived) === showArchived);
    const filtered = list.filter((item) =>
      filter === "all" ? true : filter === "active" ? !item.completed : item.completed,
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "alpha") return a.text.localeCompare(b.text, lang === "ar" ? "ar" : "en");
      if (sort === "status") return Number(a.completed) - Number(b.completed);
      if (sort === "newest") return b.createdAt - a.createdAt;
      return (
        PRIORITY_WEIGHT[a.priority ?? "medium"] - PRIORITY_WEIGHT[b.priority ?? "medium"] ||
        b.createdAt - a.createdAt
      );
    });
    return sorted;
  }, [items, filter, showArchived, sort, lang]);

  function addItem(text: string) {
    const value = text.trim();
    if (!value) return;
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        text: value,
        completed: false,
        createdAt: Date.now(),
        priority,
        category: showCategories ? category : undefined,
      },
    ]);
    setDraft("");
  }

  /** Optional dictation; silently unavailable on browsers without the API. */
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = lang === "ar" ? "ar-SA" : "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript as string | undefined;
      if (transcript) setDraft((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  const supportsVoice =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  return (
    <section className="rounded-2xl p-4 pomo-panel">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs pomo-muted">
          {items.filter((item) => item.completed && !item.archived).length}/
          {items.filter((item) => !item.archived).length}
        </span>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          addItem(draft);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={pt(lang, "addTask")}
          className="min-w-40 flex-1 rounded-lg px-3 py-2 text-sm pomo-field"
        />
        <select
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          aria-label={pt(lang, "priority")}
          className="rounded-lg px-2 py-2 text-xs pomo-field"
        >
          <option value="high">{lang === "ar" ? "عالية" : "High"}</option>
          <option value="medium">{lang === "ar" ? "متوسطة" : "Medium"}</option>
          <option value="low">{lang === "ar" ? "منخفضة" : "Low"}</option>
        </select>
        {showCategories && (
          <select
            value={category}
            onChange={(event) => {
              if (event.target.value === "__new") {
                const name = window.prompt(pt(lang, "newCategory"));
                if (name?.trim()) {
                  onAddCategory?.(name.trim());
                  setCategory(name.trim());
                }
                return;
              }
              setCategory(event.target.value);
            }}
            aria-label={pt(lang, "category")}
            className="rounded-lg px-2 py-2 text-xs pomo-field"
          >
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__new">+ {pt(lang, "newCategory")}</option>
          </select>
        )}
        {supportsVoice && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={pt(lang, "voiceInput")}
            className="rounded-lg border p-2"
            style={{
              borderColor: "var(--pomo-ring)",
              background: listening ? "var(--pomo-accent-soft)" : "transparent",
            }}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="rounded-lg p-2 pomo-accent-bg" aria-label={pt(lang, "addTask")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {(["all", "active", "done"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setFilter(mode)}
            className="rounded-full px-3 py-1"
            style={{
              background: filter === mode ? "var(--pomo-accent-soft)" : "transparent",
              border: "1px solid var(--pomo-ring)",
            }}
          >
            {pt(lang, mode === "all" ? "filterAll" : mode === "active" ? "filterActive" : "filterDone")}
          </button>
        ))}
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          aria-label={pt(lang, "sortBy")}
          className="ms-auto rounded-lg px-2 py-1 pomo-field"
        >
          <option value="priority">{pt(lang, "sortPriority")}</option>
          <option value="alpha">{pt(lang, "sortAlpha")}</option>
          <option value="status">{pt(lang, "sortStatus")}</option>
          <option value="newest">{pt(lang, "sortNewest")}</option>
        </select>
        <button
          type="button"
          onClick={() => setShowArchived((value) => !value)}
          className="rounded-full px-3 py-1"
          style={{
            background: showArchived ? "var(--pomo-accent-soft)" : "transparent",
            border: "1px solid var(--pomo-ring)",
          }}
        >
          {pt(lang, "archived")}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {visible.length === 0 && <li className="text-xs pomo-muted">{pt(lang, "empty")}</li>}
        {visible.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ border: "1px solid var(--pomo-ring)" }}
          >
            <button
              type="button"
              onClick={() =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id
                      ? {
                          ...entry,
                          completed: !entry.completed,
                          completedAt: entry.completed ? undefined : Date.now(),
                        }
                      : entry,
                  ),
                )
              }
              aria-label={item.text}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md"
              style={{
                border: "1px solid var(--pomo-ring)",
                background: item.completed ? "var(--pomo-accent)" : "transparent",
              }}
            >
              {item.completed && <Check className="h-3 w-3" aria-hidden="true" />}
            </button>
            <span
              className="flex-1 text-sm"
              style={{
                textDecoration: item.completed ? "line-through" : undefined,
                opacity: item.completed ? 0.6 : 1,
              }}
            >
              {item.text}
            </span>
            {item.category && <span className="text-[11px] pomo-muted">{item.category}</span>}
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: PRIORITY_COLOR[item.priority ?? "medium"] }}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id ? { ...entry, archived: !entry.archived } : entry,
                  ),
                )
              }
              aria-label={pt(lang, "archive")}
              className="pomo-muted"
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
              aria-label={pt(lang, "delete")}
              className="pomo-muted"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
