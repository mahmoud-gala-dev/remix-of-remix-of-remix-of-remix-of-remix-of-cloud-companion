import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A copyable code block used across the integration setup guides. */
export function CopyBlock({ label, value }: { label?: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-foreground">{label}</p>}
      <div className="flex items-stretch gap-2">
        <pre className="flex-1 overflow-x-auto rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed">
          {value}
        </pre>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={copy}
          aria-label={`Copy ${label ?? "value"}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

/** Numbered setup steps with optional documentation links. */
export function SetupSteps({
  steps,
  links,
}: {
  steps: React.ReactNode[];
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Setup steps</p>
      <ol className="list-decimal space-y-1.5 ps-4">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {links && links.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
