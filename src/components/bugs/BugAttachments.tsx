import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ClipboardPaste,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Square,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBugMedia } from "@/hooks/useBugMedia";
import { usePasteScreenshot } from "@/hooks/usePasteScreenshot";
import { useScreenRecorder } from "@/hooks/useScreenRecorder";
import { MAX_ATTACHMENT_BYTES, type Attachment } from "@/lib/api";
import { BugMediaDropzone } from "@/components/bugs/BugMediaDropzone";

function formatElapsed(secs: number) {
  const minutes = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (secs % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function uploadLimitLabel() {
  return `${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB`;
}

export function BugAttachments({ bugId }: { bugId: number }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);

  const {
    attachments,
    urls,
    progress,
    grouped: { images, videos, files, links },
    isUploading,
    uploadFiles,
    addLink,
    deleteAttachment,
  } = useBugMedia(bugId);

  const uploadWithToast = useCallback(
    (filesToUpload: File[], successMessage = "Upload complete") => {
      uploadFiles(filesToUpload, {
        onSuccess: () => toast.success(successMessage),
        onError: (error) => toast.error(error.message),
      });
    },
    [uploadFiles],
  );

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      uploadWithToast(Array.from(list));
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [uploadWithToast],
  );

  const handleAddLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) return;
    addLink(url)
      .then(() => {
        setLinkUrl("");
        toast.success("Link added");
      })
      .catch((error: Error) => toast.error(error.message));
  }, [addLink, linkUrl]);

  const { pastedFile, clear: clearPaste } = usePasteScreenshot({ enabled: true });

  useEffect(() => {
    if (!pastedFile) return;
    uploadWithToast([pastedFile], "Screenshot uploaded");
    clearPaste();
    toast.info("Screenshot pasted. Uploading...");
  }, [clearPaste, pastedFile, uploadWithToast]);

  const handleRecorded = useCallback(
    (blob: Blob, mimeType: string) => {
      if (blob.size === 0) {
        toast.error("Recording could not be saved because the captured video was empty.");
        return;
      }

      const recordingType = mimeType.includes("mp4") ? "video/mp4" : "video/webm";
      const ext = recordingType === "video/mp4" ? "mp4" : "webm";
      const file = new File([blob], `screen-recording-${Date.now()}.${ext}`, {
        type: recordingType,
      });

      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          `Recording is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The upload limit is ${uploadLimitLabel()}.`,
        );
        return;
      }

      uploadWithToast([file], "Recording uploaded");
      toast.info("Recording saved. Uploading...");
    },
    [uploadWithToast],
  );

  const {
    state: recState,
    start: startRec,
    stop: stopRec,
    elapsed,
    isSupported: recSupported,
  } = useScreenRecorder({
    onRecorded: handleRecorded,
    onError: (message) => toast.error(message),
  });

  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    deleteAttachment(pendingDelete, {
      onSuccess: () => {
        setPendingDelete(null);
        toast.success("Attachment removed");
      },
      onError: (error) => toast.error(error.message),
    });
  }, [deleteAttachment, pendingDelete]);

  return (
    <Card className="relative border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Attachments</span>
          {recState === "recording" && (
            <Badge
              variant="outline"
              className="gap-1.5 border-destructive/40 bg-destructive/10 text-xs text-destructive"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
              REC {formatElapsed(elapsed)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,application/pdf"
            multiple
            className="hidden"
            aria-label="Choose files to upload"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {isUploading ? "Uploading..." : "Upload file"}
          </Button>

          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <Input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Paste link URL"
              aria-label="Attachment link URL"
              className="h-9"
              onKeyDown={(event) => event.key === "Enter" && handleAddLink()}
            />
            <Button size="sm" variant="outline" onClick={handleAddLink}>
              <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
              Add link
            </Button>
          </div>
        </div>

        <BugMediaDropzone
          disabled={isUploading}
          onFilesAccepted={(filesToUpload) => uploadWithToast(filesToUpload)}
          onError={(message) => toast.error(message)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-md border border-dashed border-border/70 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <ClipboardPaste className="h-3.5 w-3.5 shrink-0" />
            <span>
              Press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">Ctrl+V</kbd>{" "}
              to paste a screenshot
            </span>
          </div>

          {recSupported && recState === "idle" && (
            <Button size="sm" variant="outline" onClick={startRec}>
              <Video className="mr-1.5 h-3.5 w-3.5 text-destructive" />
              Record Screen
            </Button>
          )}
          {recSupported && recState === "requesting" && (
            <Button size="sm" variant="outline" disabled>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Waiting for permission...
            </Button>
          )}
          {recSupported && recState === "recording" && (
            <Button size="sm" variant="destructive" onClick={stopRec}>
              <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Stop Recording
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Images, videos, and PDFs up to {uploadLimitLabel()}.
        </p>

        {progress !== null && <Progress value={progress} aria-label="Upload progress" />}

        {images.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Images
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((att) => (
                <div
                  key={att.id}
                  className="group relative overflow-hidden rounded-md border border-border"
                >
                  {urls[att.id] ? (
                    <img
                      src={urls[att.id]}
                      alt={att.filename ?? "Bug screenshot"}
                      className="h-28 w-full cursor-pointer object-cover"
                      onClick={() => setLightbox(urls[att.id] ?? null)}
                    />
                  ) : (
                    <div className="h-28 w-full animate-pulse bg-muted" />
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    aria-label={`Delete attachment ${att.filename ?? att.id}`}
                    className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setPendingDelete(att)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Videos & Screen Recordings
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {videos.map((att) => (
                <div
                  key={att.id}
                  className="group relative rounded-md border border-border bg-black/40 p-2"
                >
                  {urls[att.id] ? (
                    <video
                      src={urls[att.id]}
                      controls
                      preload="metadata"
                      className="max-h-40 w-full rounded bg-black object-contain"
                    />
                  ) : (
                    <div className="h-28 w-full animate-pulse rounded bg-muted" />
                  )}
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="max-w-[200px] truncate">
                      {att.filename ?? "Screen Recording"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => setPendingDelete(att)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Documents
            </p>
            {files.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <a
                  href={urls[att.id] ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 truncate text-primary hover:underline"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{att.filename ?? att.content}</span>
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete attachment ${att.filename ?? att.id}`}
                  className="h-6 w-6 shrink-0"
                  onClick={() => setPendingDelete(att)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {links.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Links
            </p>
            {links.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <a
                  href={att.content}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-1.5 truncate text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{att.content}</span>
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete link ${att.content}`}
                  className="h-6 w-6 shrink-0"
                  onClick={() => setPendingDelete(att)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {attachments.length === 0 && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" /> No attachments yet
          </p>
        )}
      </CardContent>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the attachment from this bug.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6"
          onClick={() => setLightbox(null)}
          role="button"
          tabIndex={0}
          aria-label="Close image preview"
          onKeyDown={(event) => event.key === "Escape" && setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Attachment preview"
            className="max-h-full max-w-full rounded-md object-contain"
          />
        </div>
      )}
    </Card>
  );
}
