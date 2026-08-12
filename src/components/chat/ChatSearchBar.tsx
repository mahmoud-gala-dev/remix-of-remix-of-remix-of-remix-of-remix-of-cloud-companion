import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

/** Search field for the active chat channel. */
export function ChatSearchBar({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="relative w-full sm:w-64">
      <Search
        className="pointer-events-none absolute inset-y-0 start-2 my-auto h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("chat.search")}
        aria-label={t("chat.search")}
        className="h-9 ps-8 pe-8"
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          aria-label={t("chat.clearSearch")}
          onClick={() => onChange("")}
          className="absolute inset-y-0 end-2 my-auto h-4 w-4 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
