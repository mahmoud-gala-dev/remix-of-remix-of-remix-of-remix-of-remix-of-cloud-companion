import { useCallback, useEffect, useState, type DragEvent } from "react";
import { validateAttachmentFile } from "@/lib/api";

export type UseDragAndDropOptions = {
  onFilesDropped: (files: File[]) => void;
  onError?: (errorMessage: string) => void;
  enabled?: boolean;
};

/**
 * Custom hook for Drag and Drop file upload functionality.
 * Tracks drag-over state and processes dropped files with validation and event cleanup.
 */
export function useDragAndDrop({ onFilesDropped, onError, enabled = true }: UseDragAndDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [enabled, isDragging],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only turn off dragging when leaving the drag area container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (!enabled) return;

      const droppedItems = Array.from(e.dataTransfer.files);
      if (droppedItems.length === 0) return;

      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of droppedItems) {
        const problem = validateAttachmentFile(file);
        if (problem) {
          errors.push(problem);
        } else {
          validFiles.push(file);
        }
      }

      if (errors.length > 0 && onError) {
        onError(errors.join(" "));
      }

      if (validFiles.length > 0) {
        onFilesDropped(validFiles);
      }
    },
    [enabled, onFilesDropped, onError],
  );

  // Safeguard: Ensure drag state resets if window loses focus
  useEffect(() => {
    const handleWindowBlur = () => setIsDragging(false);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  return {
    isDragging,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
