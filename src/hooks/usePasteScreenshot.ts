import { useCallback, useEffect, useState } from "react";

/**
 * Listens for `paste` events on `window` and extracts the first image item
 * from the clipboard. Returns the pasted File (or null) and a `clear` helper
 * to reset the state after the caller has handled the image.
 *
 * Usage:
 *   const { pastedFile, clear } = usePasteScreenshot({ enabled: true });
 *   useEffect(() => {
 *     if (pastedFile) { upload(pastedFile); clear(); }
 *   }, [pastedFile]);
 */
export function usePasteScreenshot({ enabled = true }: { enabled?: boolean } = {}) {
  const [pastedFile, setPastedFile] = useState<File | null>(null);

  const clear = useCallback(() => setPastedFile(null), []);

  useEffect(() => {
    if (!enabled) return;

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (!blob) continue;

          // Give the screenshot a meaningful filename with a timestamp
          const ext = item.type.split("/")[1] ?? "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const file = new File([blob], filename, { type: item.type });

          event.preventDefault();
          setPastedFile(file);
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enabled]);

  return { pastedFile, clear };
}
