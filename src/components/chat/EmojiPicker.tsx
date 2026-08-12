import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EMOJI_PALETTE } from "@/lib/chat-reactions";
import { cn } from "@/lib/utils";

/** Compact emoji palette used by the chat composer and the reaction bar. */
export function EmojiPicker({
  onPick,
  label,
  disabled = false,
  variant = "outline",
  className,
  icon,
}: {
  onPick: (emoji: string) => void;
  label: string;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  className?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          aria-label={label}
          disabled={disabled}
          className={className}
        >
          {icon ?? <Smile className="h-4 w-4" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className={cn("grid grid-cols-8 gap-1")}>
          {EMOJI_PALETTE.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="rounded-md p-1 text-lg leading-none transition-transform hover:scale-125 hover:bg-muted"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
