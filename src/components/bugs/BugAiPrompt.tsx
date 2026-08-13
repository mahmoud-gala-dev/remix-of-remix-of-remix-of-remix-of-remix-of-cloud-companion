import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, KeyRound, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchMyAiStatus, runAiPrompt, saveMyGeminiKey } from "@/lib/integrations.functions";
import { useI18n } from "@/lib/i18n";
import type { Bug } from "@/lib/api";

const AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";

const COPY = {
  en: {
    title: "Copy, export & AI prompt",
    kicker: "Turn this error into shareable text or an AI debugging prompt.",
    copyTitle: "Copy title",
    copyDetails: "Copy details",
    downloadTxt: "Download .txt",
    build: "Analyse with Gemini",
    running: "Thinking…",
    keyMissing: "Add your Gemini API key to use AI prompts.",
    keyPlaceholder: "Paste your Gemini API key",
    saveKey: "Save key",
    getKey: "Create a key in Google AI Studio",
    keyReady: "Gemini key saved",
    copied: "Copied to clipboard",
    result: "AI analysis",
  },
  ar: {
    title: "النسخ والتصدير وبرومبت الذكاء الاصطناعي",
    kicker: "حوّل هذا الخطأ إلى نص قابل للمشاركة أو برومبت لتحليل المشكلة.",
    copyTitle: "نسخ العنوان",
    copyDetails: "نسخ التفاصيل",
    downloadTxt: "تحميل ملف نصي",
    build: "تحليل بالذكاء الاصطناعي",
    running: "جارٍ التحليل…",
    keyMissing: "أضف مفتاح Gemini الخاص بك لاستخدام البرومبت.",
    keyPlaceholder: "الصق مفتاح Gemini",
    saveKey: "حفظ المفتاح",
    getKey: "أنشئ مفتاحًا من Google AI Studio",
    keyReady: "تم حفظ مفتاح Gemini",
    copied: "تم النسخ",
    result: "تحليل الذكاء الاصطناعي",
  },
} as const;

/** Plain-text summary of the error, used for copy, download and the AI prompt. */
export function bugToPlainText(bug: Bug) {
  const rows: [string, string | null | undefined][] = [
    ["Bug ID", bug.bug_id],
    ["Title", bug.title],
    ["Module", bug.module],
    ["Status", bug.status],
    ["Priority", bug.priority],
    ["Severity", bug.severity],
    ["Environment", bug.environment],
    ["Steps to reproduce", bug.steps],
    ["Expected result", bug.expected_result],
    ["Actual result", bug.actual_result],
    ["Notes", bug.notes],
  ];
  return rows
    .filter(([, value]) => value && String(value).trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/**
 * Developer-only helper on the bug detail page: copy the title or the full
 * details, download them as a text file, or send them to Gemini using the
 * developer's own API key.
 */
export function BugAiPrompt({ bug }: { bug: Bug }) {
  const { language, t } = useI18n();
  const copy = COPY[language === "ar" ? "ar" : "en"];
  const queryClient = useQueryClient();
  const loadStatus = useServerFn(fetchMyAiStatus);
  const saveKey = useServerFn(saveMyGeminiKey);
  const runPrompt = useServerFn(runAiPrompt);

  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");

  const status = useQuery({ queryKey: ["my-ai-status"], queryFn: () => loadStatus() });
  const hasKey = !!status.data?.hasOwnKey;

  const saveKeyMutation = useMutation({
    mutationFn: () => saveKey({ data: { apiKey: apiKey.trim() } }),
    onSuccess: () => {
      setApiKey("");
      toast.success(copy.keyReady);
      queryClient.invalidateQueries({ queryKey: ["my-ai-status"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const promptText = `You are a senior software engineer helping a developer fix a production bug.

## Bug Report
${bugToPlainText(bug)}

## Required Output
Respond in clear technical English using exactly these sections:

### 1. Bug Summary
- What is broken:
- Expected behaviour:
- Actual behaviour:
- Impact:

### 2. Reproduction Checklist
Use a Markdown checklist that a developer can paste into the Developer workspace.

### 3. Root-Cause Candidates
List the top 3 hypotheses. For each one include:
- Evidence from the report
- What to inspect in the codebase
- Confidence: High / Medium / Low

### 4. Fix Plan
Give a concrete implementation plan with likely files, functions, state, API calls, validation, and edge cases. Do not invent exact filenames unless they are present in the report.

### 5. Regression Tests
List automated tests and one manual retest path.

### 6. Developer Workspace Blocks
Return copy-ready blocks for the Developer workspace:

\`\`\`checklist
[ ] Reproduce:
[ ] Inspect:
[ ] Fix:
[ ] Test:
[ ] Retest with reporter:
\`\`\`

\`\`\`mindmap
Root cause
  Frontend
  Backend
  Data/API
  Permissions
Fix plan
  Code change
  Validation
  Regression test
\`\`\`

\`\`\`text
Developer note:
- Finding:
- Decision:
- Risk:
- Follow-up:
\`\`\`

Rules:
- Be concise but specific.
- Preserve bug IDs, URLs, field names, and technical terms.
- Avoid generic advice.
- Do not reveal hidden reasoning; provide only the final analysis and actions.`;

  const analyse = useMutation({
    mutationFn: () => runPrompt({ data: { prompt: promptText } }),
    onSuccess: (data) => setResult(data.text),
    onError: (error: Error) => toast.error(error.message),
  });

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(copy.copied);
  };

  const downloadTxt = () => {
    const blob = new Blob([bugToPlainText(bug)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${bug.bug_id || "bug"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          {copy.title}
        </CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{copy.kicker}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyText(bug.title)}>
            <Copy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {copy.copyTitle}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void copyText(bugToPlainText(bug))}>
            <Copy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {copy.copyDetails}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTxt}>
            <Download className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {copy.downloadTxt}
          </Button>
        </div>

        {hasKey ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              <KeyRound className="me-1 h-3 w-3" aria-hidden="true" />
              {copy.keyReady}
            </Badge>
            <Button size="sm" disabled={analyse.isPending} onClick={() => analyse.mutate()}>
              {analyse.isPending ? (
                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              {analyse.isPending ? copy.running : copy.build}
            </Button>
            {/* Standalone "Copy prompt" button — paste into any AI tool */}
            <Button variant="ghost" size="sm" onClick={() => void copyText(promptText)}>
              <Copy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {t("bug.ai.copyPrompt")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
            <p className="text-sm text-muted-foreground">{copy.keyMissing}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-full sm:w-72"
                type="password"
                value={apiKey}
                placeholder={copy.keyPlaceholder}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <Button
                size="sm"
                disabled={apiKey.trim().length < 10 || saveKeyMutation.isPending}
                onClick={() => saveKeyMutation.mutate()}
              >
                {copy.saveKey}
              </Button>
              <a
                href={AI_STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary underline"
              >
                {copy.getKey}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {copy.result}
            </p>
            <Textarea readOnly rows={10} value={result} className="text-[12.5px]" />
            <Button variant="outline" size="sm" onClick={() => void copyText(result)}>
              <Copy className="me-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {copy.copyDetails}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BugAiPrompt;
