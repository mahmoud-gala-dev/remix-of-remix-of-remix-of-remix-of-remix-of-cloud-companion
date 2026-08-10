import { useCallback, useMemo } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { ImagePlus, Upload } from "lucide-react";
import { MAX_ATTACHMENT_BYTES, validateAttachmentFile } from "@/lib/api";
import { cn } from "@/lib/utils";

export type BugMediaDropzoneProps = {
  disabled?: boolean;
  onFilesAccepted: (files: File[]) => void;
  onError: (message: string) => void;
};

const ACCEPTED_MEDIA = {
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
  "video/*": [".webm", ".mp4", ".mov", ".mkv"],
  "application/pdf": [".pdf"],
};

function rejectionMessage(rejections: FileRejection[]) {
  return rejections
    .flatMap((rejection) =>
      rejection.errors.map((error) => `${rejection.file.name}: ${error.message}`),
    )
    .join(" ");
}

export function BugMediaDropzone({
  disabled = false,
  onFilesAccepted,
  onError,
}: BugMediaDropzoneProps) {
  const validator = useCallback((file: File) => {
    const problem = validateAttachmentFile(file);
    return problem ? { code: "invalid-attachment", message: problem } : null;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (rejectedFiles.length > 0) onError(rejectionMessage(rejectedFiles));
      if (acceptedFiles.length > 0) onFilesAccepted(acceptedFiles);
    },
    [onError, onFilesAccepted],
  );

  const dropzone = useDropzone({
    accept: ACCEPTED_MEDIA,
    disabled,
    maxSize: MAX_ATTACHMENT_BYTES,
    multiple: true,
    onDrop,
    validator,
  });

  const helperText = useMemo(
    () =>
      `Drop screenshots, recordings, or PDFs up to ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB.`,
    [],
  );

  return (
    <div
      {...dropzone.getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/25 px-4 py-5 text-center transition-colors",
        dropzone.isDragActive && "border-primary bg-primary/10 text-primary",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input {...dropzone.getInputProps()} aria-label="Drag and drop bug media files" />
      <div className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-background text-primary">
        {dropzone.isDragActive ? <Upload className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
      </div>
      <p className="text-sm font-medium">
        {dropzone.isDragActive ? "Drop files to upload" : "Drag and drop media here"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
    </div>
  );
}
