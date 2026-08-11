import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Switches the whole UI between English (LTR) and Arabic (RTL). */
export function LanguageToggle() {
  const { language, toggleLanguage, t } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      aria-label={t("language.switchTo")}
      title={t("language.switchTo")}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase">{language === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}
