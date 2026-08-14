import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import rtlDetect from "rtl-detect";
import {
  Braces,
  CheckCheck,
  Copy,
  Download,
  Languages,
  ListChecks,
  Loader2,
  Network,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { TOKEN_CLASS, tokenizeLine } from "@/lib/code-highlight";
import { nameFor, type ProfileMap } from "@/components/bugs/types";
import {
  CODE_LANGUAGES,
  createDevNote,
  deleteDevNote,
  fetchDevNotes,
  parseChecklist,
  parseMindMap,
  stringifyChecklist,
  updateDevNote,
  type DevNote,
  type DevNoteKind,
  type MindNode,
} from "@/lib/dev-notes";

const COPY = {
  en: {
    title: "Developer workspace",
    kicker: "Code highlights, checklists and mind maps for this error",
    add: "New note",
    kind: "Type",
    code: "Code snippet",
    checklist: "Checklist",
    mindmap: "Mind map",
    language: "Language",
    noteTitle: "Title",
    body: "Content",
    save: "Save note",
    cancel: "Cancel",
    empty: "No developer notes yet. Add a snippet, checklist or mind map.",
    hintCode: "Paste the fix or the failing snippet.",
    hintChecklist: "One item per line. Prefix with [x] when it is done.",
    hintMindmap: "One idea per line; indent with two spaces to nest.",
    delete: "Delete",
    by: "by",
    example: "Insert example",
    readOnly: "Read-only for testers. Developers and supervisors can add or update notes.",
    translatorTitle: "Translate text",
    translatorHint:
      "Paste Arabic or English text, then translate it for a developer note or prompt.",
    translateTo: "Translate to",
    toEnglish: "English",
    toArabic: "Arabic",
    translate: "Translate",
    translating: "Translating...",
    sourceText: "Text to translate",
    translatedText: "Translation",
    pasteBug: "Use bug details",
    copyTranslation: "Copy translation",
    translated: "Translation ready",
  },
  ar: {
    title: "مساحة المطور",
    kicker: "أكواد مميزة وقوائم مهام وخرائط ذهنية لهذا الخطأ",
    add: "ملاحظة جديدة",
    kind: "النوع",
    code: "مقطع كود",
    checklist: "قائمة مهام",
    mindmap: "خريطة ذهنية",
    language: "اللغة",
    noteTitle: "العنوان",
    body: "المحتوى",
    save: "حفظ الملاحظة",
    cancel: "إلغاء",
    empty: "لا توجد ملاحظات بعد. أضف كودًا أو قائمة مهام أو خريطة ذهنية.",
    hintCode: "الصق الحل أو الكود المسبب للمشكلة.",
    hintChecklist: "عنصر في كل سطر، وابدأ بـ [x] عند الإنجاز.",
    hintMindmap: "فكرة في كل سطر، وأزح بمسافتين للتفريع.",
    delete: "حذف",
    by: "بواسطة",
    example: "أدخل مثالًا",
    readOnly: "عرض فقط للتيستر. المطورون والمشرفون يمكنهم إضافة أو تعديل الملاحظات.",
    translatorTitle: "ترجمة النص",
    translatorHint: "الصق نصًا عربيًا أو إنجليزيًا ثم ترجمه لملاحظة المطور أو البرومبت.",
    translateTo: "الترجمة إلى",
    toEnglish: "الإنجليزية",
    toArabic: "العربية",
    translate: "ترجمة",
    translating: "جارٍ الترجمة...",
    sourceText: "النص المراد ترجمته",
    translatedText: "الترجمة",
    pasteBug: "استخدام تفاصيل الخطأ",
    copyTranslation: "نسخ الترجمة",
    translated: "تمت الترجمة",
  },
} as const;

type DevNotesCopy = Record<keyof typeof COPY.en, string>;

const KIND_ICON: Record<DevNoteKind, typeof Braces> = {
  code: Braces,
  checklist: ListChecks,
  mindmap: Network,
};

function CodeBlock({ note }: { note: DevNote }) {
  const { t } = useI18n();
  const lines = note.content.replace(/\n$/, "").split("\n");
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState(false);

  const handleCopyRaw = () => {
    void navigator.clipboard.writeText(note.content);
    setCopiedRaw(true);
    window.setTimeout(() => setCopiedRaw(false), 1500);
  };

  const handleCopyBlock = () => {
    const markdown = `\`\`\`${note.language}\n${note.content}\n\`\`\``;
    void navigator.clipboard.writeText(markdown);
    setCopiedBlock(true);
    window.setTimeout(() => setCopiedBlock(false), 1500);
  };

  const handleDownload = () => {
    const ext =
      note.language === "ts" || note.language === "tsx"
        ? note.language
        : note.language === "python"
          ? "py"
          : note.language === "bash"
            ? "sh"
            : note.language;
    const blob = new Blob([note.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.title || "snippet"}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-[oklch(0.18_0.03_255)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {note.language}
        </span>
        <div className="flex items-center gap-2">
          {/* Copy raw code */}
          <button
            type="button"
            title="Copy code"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleCopyRaw}
          >
            {copiedRaw ? (
              <CheckCheck className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copiedRaw ? "copied" : "copy"}
          </button>
          {/* Copy as Markdown block */}
          <button
            type="button"
            title={t("bug.devnote.copyBlock")}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleCopyBlock}
          >
            {copiedBlock ? (
              <CheckCheck className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copiedBlock ? "copied" : "block"}
          </button>
          {/* Download as file */}
          <button
            type="button"
            title={t("bug.devnote.download")}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleDownload}
          >
            <Download className="h-3 w-3" />
            dl
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <pre className="min-w-full p-0 text-[12.5px] leading-relaxed">
          <code className="block font-mono">
            {lines.map((line, index) => (
              <span key={index} className="flex gap-3 px-3 py-0.5 hover:bg-foreground/5">
                <span className="w-6 shrink-0 select-none text-end text-muted-foreground/60">
                  {index + 1}
                </span>
                <span className="whitespace-pre">
                  {tokenizeLine(line, note.language).map((token, tIndex) => (
                    <span key={tIndex} className={TOKEN_CLASS[token.type]}>
                      {token.value}
                    </span>
                  ))}
                  {line === "" ? " " : null}
                </span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

const MIND_TONES = [
  "bg-primary text-primary-foreground border-primary",
  "bg-primary/15 text-primary border-primary/40",
  "bg-warning/15 text-warning border-warning/40",
  "bg-success/15 text-success border-success/40",
  "bg-muted text-foreground border-border",
] as const;

function MindBranch({ nodes, depth }: { nodes: MindNode[]; depth: number }) {
  const tone = MIND_TONES[Math.min(depth, MIND_TONES.length - 1)]!;
  return (
    <ul className="flex flex-col justify-center gap-2">
      {nodes.map((node, index) => (
        <li key={`${depth}-${index}-${node.label}`} className="relative flex items-center gap-4">
          {/* horizontal connector back to the parent node */}
          <span aria-hidden="true" className="absolute -start-4 top-1/2 h-px w-4 bg-border" />
          <span
            className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium shadow-sm ${tone}`}
          >
            {node.label}
          </span>
          {node.children.length > 0 && (
            <div className="border-s border-border ps-4">
              <MindBranch nodes={node.children} depth={depth + 1} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/** XMind-style horizontal map: a central topic branching out into sub-topics. */
function MindMap({ note }: { note: DevNote }) {
  const roots = parseMindMap(note.content);
  if (roots.length === 0) return null;
  const [center, ...siblings] = roots;
  const branches = [...center!.children, ...siblings];
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <div className="flex items-center gap-4">
        <span className="inline-flex shrink-0 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow">
          {center!.label}
        </span>
        {branches.length > 0 && (
          <div className="border-s-2 border-primary/40 ps-4">
            <MindBranch nodes={branches} depth={1} />
          </div>
        )}
      </div>
    </div>
  );
}

const EXAMPLES: Record<DevNoteKind, string> = {
  code: `// Root cause: the token was read before hydration\nconst token = typeof window === "undefined" ? null : localStorage.getItem("token");\n\nif (!token) {\n  redirectToLogin();\n}`,
  checklist: `[x] Reproduce the bug locally\n[x] Find the failing request\n[ ] Write a regression test\n[ ] Fix the query filter\n[ ] Ask the tester to retest`,
  mindmap: `Login fails on refresh\n  Frontend\n    Session read too early\n    Missing loading state\n  Backend\n    Token expiry 15m\n    Refresh endpoint 401\n  Fix plan\n    Await session before render\n    Retry refresh once`,
};

function hasArabicText(value: string) {
  return /[\u0600-\u06FF]/.test(value);
}

function splitForFreeTranslation(text: string) {
  const chunks: string[] = [];
  for (const block of text.split(/(\n+)/)) {
    if (!block || /^\n+$/.test(block)) {
      chunks.push(block);
      continue;
    }
    for (let index = 0; index < block.length; index += 450) {
      chunks.push(block.slice(index, index + 450));
    }
  }
  return chunks;
}

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseStatus?: number;
  responseDetails?: string;
};

async function translateWithMyMemory(text: string, targetLanguage: "en" | "ar") {
  const sourceLanguage = hasArabicText(text) ? "ar" : "en";
  if (sourceLanguage === targetLanguage) return text;

  const translated = await Promise.all(
    splitForFreeTranslation(text).map(async (chunk) => {
      if (!chunk.trim() || /^\n+$/.test(chunk)) return chunk;
      const params = new URLSearchParams({
        q: chunk,
        langpair: `${sourceLanguage}|${targetLanguage}`,
      });
      const response = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      if (!response.ok) throw new Error(`Translation failed (${response.status}).`);
      const data = (await response.json()) as MyMemoryResponse;
      if (data.responseStatus && data.responseStatus >= 400) {
        throw new Error(data.responseDetails || "Translation service rejected the request.");
      }
      return data.responseData?.translatedText ?? chunk;
    }),
  );

  return translated.join("");
}

function TranslationPanel({ copy, bugText }: { copy: DevNotesCopy; bugText: string | undefined }) {
  const [sourceText, setSourceText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<"en" | "ar">("en");
  const [translatedText, setTranslatedText] = useState("");
  const sourceDir = hasArabicText(sourceText) ? "rtl" : "ltr";
  const targetDir = rtlDetect.getLangDir(targetLanguage);

  const translate = useMutation({
    mutationFn: () => translateWithMyMemory(sourceText.trim(), targetLanguage),
    onSuccess: (data) => {
      setTranslatedText(data);
      toast.success(copy.translated);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const fillBugText = () => {
    if (!bugText) return;
    setSourceText(bugText);
    setTargetLanguage(hasArabicText(bugText) ? "en" : "ar");
  };

  const copyResult = async () => {
    await navigator.clipboard.writeText(translatedText);
    toast.success(copy.copyTranslation);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Languages className="h-4 w-4 text-primary" aria-hidden="true" />
            {copy.translatorTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{copy.translatorHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          {bugText && (
            <Button variant="outline" size="sm" className="max-sm:flex-1" onClick={fillBugText}>
              {copy.pasteBug}
            </Button>
          )}
          <Select
            value={targetLanguage}
            onValueChange={(value) => setTargetLanguage(value as "en" | "ar")}
          >
            <SelectTrigger className="h-9 w-36 max-sm:flex-1">
              <SelectValue aria-label={copy.translateTo} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{copy.toEnglish}</SelectItem>
              <SelectItem value="ar">{copy.toArabic}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="max-sm:w-full"
            disabled={!sourceText.trim() || translate.isPending}
            onClick={() => translate.mutate()}
          >
            {translate.isPending ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Languages className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {translate.isPending ? copy.translating : copy.translate}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium">{copy.sourceText}</label>
          <Textarea
            rows={7}
            dir={sourceDir}
            value={sourceText}
            onChange={(event) => {
              const next = event.target.value;
              setSourceText(next);
              if (next.trim()) setTargetLanguage(hasArabicText(next) ? "en" : "ar");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium">{copy.translatedText}</label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={!translatedText}
              onClick={() => void copyResult()}
            >
              <Copy className="me-1 h-3.5 w-3.5" aria-hidden="true" />
              {copy.copyTranslation}
            </Button>
          </div>
          <Textarea readOnly rows={7} dir={targetDir} value={translatedText} />
        </div>
      </div>
    </div>
  );
}

function ChecklistBlock({
  note,
  canEdit,
  onChange,
}: {
  note: DevNote;
  canEdit: boolean;
  onChange: (content: string) => void;
}) {
  const items = parseChecklist(note.content);
  const done = items.filter((item) => item.done).length;
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {done}/{items.length}
      </p>
      {items.map((item, index) => (
        <label key={index} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-3.5 w-3.5 accent-[var(--primary)]"
            checked={item.done}
            disabled={!canEdit}
            onChange={() =>
              onChange(
                stringifyChecklist(
                  items.map((entry, i) => (i === index ? { ...entry, done: !entry.done } : entry)),
                ),
              )
            }
          />
          <span className={item.done ? "text-muted-foreground line-through" : undefined}>
            {item.text}
          </span>
        </label>
      ))}
    </div>
  );
}

/**
 * Developer-facing knowledge panel on the error detail page: snippets with
 * line numbers, tickable checklists and indented mind maps. Row-level security
 * decides who can read or write, so the panel simply reflects it.
 */
export function BugDevNotes({
  bugId,
  currentUserId,
  canWrite,
  profileMap,
  bugText,
}: {
  bugId: number;
  currentUserId: string | null;
  canWrite: boolean;
  profileMap: ProfileMap;
  bugText?: string;
}) {
  const { language } = useI18n();
  const copy = COPY[language === "ar" ? "ar" : "en"];
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Translator lives in its own collapsible widget inside the workspace.
  const [translatorOpen, setTranslatorOpen] = useState(false);
  const [draft, setDraft] = useState<{
    kind: DevNoteKind;
    title: string;
    content: string;
    language: string;
  }>({ kind: "code", title: "", content: "", language: "ts" });

  const notesQuery = useQuery({
    queryKey: ["bug-dev-notes", bugId],
    queryFn: () => fetchDevNotes(bugId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bug-dev-notes", bugId] });

  const create = useMutation({
    mutationFn: () => {
      if (!currentUserId) throw new Error("Sign in required");
      return createDevNote({ bugId, authorId: currentUserId, ...draft });
    },
    onSuccess: () => {
      setOpen(false);
      setDraft({ kind: "code", title: "", content: "", language: "ts" });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patch = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      updateDevNote(id, { content }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteDevNote(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const notes = notesQuery.data ?? [];
  const hint =
    draft.kind === "code"
      ? copy.hintCode
      : draft.kind === "checklist"
        ? copy.hintChecklist
        : copy.hintMindmap;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Braces className="h-4 w-4 text-primary" aria-hidden="true" />
            {copy.title}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{copy.kicker}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
          <Button
            size="sm"
            variant={translatorOpen ? "secondary" : "outline"}
            className="max-sm:flex-1"
            aria-expanded={translatorOpen}
            onClick={() => setTranslatorOpen((value) => !value)}
          >
            <Languages className="me-1.5 h-4 w-4" aria-hidden="true" />
            {copy.translatorTitle}
          </Button>
          {canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="max-sm:flex-1"
              onClick={() => setOpen((value) => !value)}
            >
              <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
              {copy.add}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canWrite && (
          <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {copy.readOnly}
          </p>
        )}

        {translatorOpen && <TranslationPanel copy={copy} bugText={bugText} />}

        {open && canWrite && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{copy.kind}</label>
                <Select
                  value={draft.kind}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, kind: value as DevNoteKind }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">{copy.code}</SelectItem>
                    <SelectItem value="checklist">{copy.checklist}</SelectItem>
                    <SelectItem value="mindmap">{copy.mindmap}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.kind === "code" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{copy.language}</label>
                  <Select
                    value={draft.language}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CODE_LANGUAGES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{copy.noteTitle}</label>
                <Input
                  className="h-9"
                  value={draft.title}
                  onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{copy.body}</label>
              <Textarea
                rows={draft.kind === "code" ? 8 : 6}
                className={draft.kind === "code" ? "font-mono text-[12.5px]" : undefined}
                value={draft.content}
                onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="me-auto"
                onClick={() => setDraft((prev) => ({ ...prev, content: EXAMPLES[prev.kind] }))}
              >
                {copy.example}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                {copy.cancel}
              </Button>
              <Button
                size="sm"
                disabled={!draft.content.trim() || create.isPending}
                onClick={() => create.mutate()}
              >
                {copy.save}
              </Button>
            </div>
          </div>
        )}

        {notesQuery.isLoading && <Skeleton className="h-24 w-full rounded-lg" />}

        {!notesQuery.isLoading && notes.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{copy.empty}</p>
        )}

        {notes.map((note) => {
          const Icon = KIND_ICON[note.kind];
          const mine = note.author_id === currentUserId;
          const canModifyNote = canWrite && mine;
          return (
            <article key={note.id} className="space-y-2 rounded-lg border border-border/60 p-3">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate text-sm font-semibold">
                    {note.title || copy[note.kind]}
                  </span>
                  {note.kind === "code" && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {note.language}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {copy.by} {nameFor(profileMap, note.author_id)}
                  </span>
                  {canModifyNote && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive"
                      aria-label={copy.delete}
                      onClick={() => remove.mutate(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </header>

              {note.kind === "code" && <CodeBlock note={note} />}
              {note.kind === "checklist" && (
                <ChecklistBlock
                  note={note}
                  canEdit={canModifyNote}
                  onChange={(content) => patch.mutate({ id: note.id, content })}
                />
              )}
              {note.kind === "mindmap" && <MindMap note={note} />}
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default BugDevNotes;
