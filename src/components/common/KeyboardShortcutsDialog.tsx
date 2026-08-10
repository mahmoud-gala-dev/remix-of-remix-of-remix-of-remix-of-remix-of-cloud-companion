import { Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ShortcutDoc = { keys: string[]; description: string };

export const BUG_DETAIL_SHORTCUTS: ShortcutDoc[] = [
  { keys: ["←"], description: "Go to previous bug" },
  { keys: ["→"], description: "Go to next bug" },
  { keys: ["J"], description: "Next bug (vim style)" },
  { keys: ["K"], description: "Previous bug (vim style)" },
  { keys: ["B"], description: "Back to the bugs list" },
  { keys: ["N"], description: "Report a new bug" },
  { keys: ["C"], description: "Jump to the comment box" },
  { keys: ["E"], description: "Scroll to bug details panel" },
  { keys: ["D"], description: "Delete this bug (if allowed)" },
  { keys: ["G"], description: "Go to dashboard" },
  { keys: ["R"], description: "Refresh this bug's data" },
  { keys: ["?"], description: "Open this shortcuts help" },
  { keys: ["Esc"], description: "Close dialogs" },
];

function Key({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsDialog({
  shortcuts = BUG_DETAIL_SHORTCUTS,
  open,
  onOpenChange,
  showTrigger = true,
}: {
  shortcuts?: ShortcutDoc[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}) {
  return (
    <Dialog {...(open === undefined ? {} : { open })} {...(onOpenChange ? { onOpenChange } : {})}>
      {showTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Keyboard shortcuts">
            <Keyboard className="mr-1.5 h-4 w-4" /> Shortcuts
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Work faster without leaving the keyboard. Shortcuts are disabled while typing in a
            field.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut.description}
              className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <span className="text-muted-foreground">{shortcut.description}</span>
              <span className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <Key key={key}>{key}</Key>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
