import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Languages,
  ArrowLeftRight,
  Loader2,
  Copy,
  CheckCheck,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { addDevLocalNote } from "@/lib/dev-local-notes";
import { hasArabicText, translateText } from "@/lib/translator";

export function BugDevTranslator({ bugId }: { bugId: number }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [manualTargetLang, setManualTargetLang] = useState<"ar" | "en" | null>(null);
  const [copiedTranslation, setCopiedTranslation] = useState(false);

  // Derive source and target languages based on auto-detection or manual override
  const isSourceArabic = hasArabicText(sourceText);
  const autoTargetLang: "ar" | "en" = isSourceArabic ? "en" : "ar";
  const effectiveTargetLang = manualTargetLang ?? autoTargetLang;
  const effectiveSourceLang: "ar" | "en" = effectiveTargetLang === "ar" ? "en" : "ar";

  const sourceDir = effectiveSourceLang === "ar" ? "rtl" : "ltr";
  const targetDir = effectiveTargetLang === "ar" ? "rtl" : "ltr";

  // Translation mutation
  const translateMutation = useMutation({
    mutationFn: () =>
      translateText(sourceText, effectiveTargetLang, effectiveSourceLang),
    onSuccess: (result) => {
      setTranslatedText(result);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Translation error");
    },
  });

  const handleSwapLanguages = () => {
    const nextTarget: "ar" | "en" = effectiveTargetLang === "ar" ? "en" : "ar";
    setManualTargetLang(nextTarget);
    if (translatedText) {
      const prevSource = sourceText;
      setSourceText(translatedText);
      setTranslatedText(prevSource);
    }
  };

  const handleCopyTranslation = () => {
    if (!translatedText) return;
    void navigator.clipboard.writeText(translatedText);
    setCopiedTranslation(true);
    toast.success(t("bug.devLocalNotes.translator.copied"));
    window.setTimeout(() => setCopiedTranslation(false), 2000);
  };

  const handleSaveTranslationAsNote = async () => {
    if (!translatedText.trim()) return;
    try {
      await addDevLocalNote({
        bugId,
        title: undefined,
        content: translatedText.trim(),
        category: "general",
      });
      queryClient.invalidateQueries({ queryKey: ["bug-dev-local-notes", bugId] });
      toast.success(t("bug.devLocalNotes.translator.savedAsNote"));
    } catch {
      toast.error("Failed to save translation note");
    }
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Languages className="h-4 w-4 text-primary" />
            <span>{t("bug.devLocalNotes.translator.title")}</span>
            <Badge
              variant="outline"
              className="gap-1 border-primary/20 bg-primary/5 text-[11px] font-normal text-primary"
            >
              <Sparkles className="h-3 w-3" />
              {t("bug.devLocalNotes.translator.auto")}
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-1">
            {/* Direction indicator badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md border border-border/40">
              <span>{t(`bug.devLocalNotes.translator.${effectiveSourceLang}` as any)}</span>
              <ArrowLeftRight className="h-3 w-3 opacity-60" />
              <span className="font-semibold text-foreground">
                {t(`bug.devLocalNotes.translator.${effectiveTargetLang}` as any)}
              </span>
            </div>

            {/* Swap button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title={t("bug.devLocalNotes.translator.swap")}
              onClick={handleSwapLanguages}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Input Textarea */}
        <div className="relative">
          <Textarea
            rows={3}
            dir={sourceDir}
            value={sourceText}
            placeholder={t("bug.devLocalNotes.translator.sourcePlaceholder")}
            onChange={(e) => {
              setSourceText(e.target.value);
              // Reset manual override if user begins typing again
              if (manualTargetLang) setManualTargetLang(null);
            }}
            className="text-xs resize-y bg-background font-sans pr-7"
          />
          {sourceText && (
            <button
              type="button"
              onClick={() => {
                setSourceText("");
                setTranslatedText("");
              }}
              className="absolute top-2 end-2 p-1 text-muted-foreground hover:text-foreground rounded"
              title={t("bug.devLocalNotes.translator.clear")}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Action / Trigger Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-muted-foreground">
            {isSourceArabic ? "عربي ➔ إنجليزي (تلقائي)" : "English ➔ عربي (Auto)"}
          </span>

          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs font-medium"
            disabled={!sourceText.trim() || translateMutation.isPending}
            onClick={() => translateMutation.mutate()}
          >
            {translateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Languages className="h-3.5 w-3.5" />
            )}
            {translateMutation.isPending
              ? t("bug.devLocalNotes.translator.translating")
              : t("bug.devLocalNotes.translator.translate")}
          </Button>
        </div>

        {/* Output Textarea / Card */}
        {translatedText && (
          <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span className="text-primary font-semibold">
                {t(`bug.devLocalNotes.translator.${effectiveTargetLang}` as any)}:
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={handleCopyTranslation}
                >
                  {copiedTranslation ? (
                    <CheckCheck className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{t("bug.devLocalNotes.translator.copy")}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[11px] border-primary/40 bg-background text-primary hover:bg-primary/10"
                  onClick={handleSaveTranslationAsNote}
                >
                  <Plus className="h-3 w-3" />
                  <span>{t("bug.devLocalNotes.translator.saveAsNote")}</span>
                </Button>
              </div>
            </div>

            <div
              dir={targetDir}
              className="text-xs text-foreground whitespace-pre-wrap break-words leading-relaxed font-sans bg-background/90 rounded-md p-2.5 border border-border/50 shadow-xs"
            >
              {translatedText}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
