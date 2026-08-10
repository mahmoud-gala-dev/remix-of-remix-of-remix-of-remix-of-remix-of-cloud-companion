import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopped";

export type UseScreenRecorderOptions = {
  onRecorded: (blob: Blob, mimeType: string) => void;
  onError?: (message: string) => void;
};

export function useScreenRecorder({ onRecorded, onError }: UseScreenRecorderOptions) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [stopTimer]);

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [stopTimer]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      onError?.("Screen recording is not supported in this browser.");
      return;
    }

    setState("requesting");

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      streamRef.current = stream;

      const mimeType =
        ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((candidate) =>
          MediaRecorder.isTypeSupported(candidate),
        ) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        onError?.("Screen recording failed while capturing video.");
      };

      recorder.onstop = () => {
        stopTimer();
        setState("stopped");
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: mimeType || "video/webm",
        });
        onRecorded(blob, mimeType || "video/webm");

        window.setTimeout(() => {
          setState("idle");
          setElapsed(0);
        }, 500);
      };

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(250);
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    } catch (error) {
      setState("idle");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (error instanceof Error && error.name === "NotAllowedError") {
        onError?.("Screen recording permission was not granted.");
      } else if (error instanceof Error) {
        onError?.(error.message || "Screen recording could not start.");
        console.error("[useScreenRecorder]", error);
      } else {
        onError?.("Screen recording could not start.");
      }
    }
  }, [onError, onRecorded, stopTimer]);

  const stop = useCallback(() => {
    if (state !== "recording") return;
    stopRecording();
  }, [state, stopRecording]);

  const isSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  return { state, start, stop, elapsed, isSupported };
}
