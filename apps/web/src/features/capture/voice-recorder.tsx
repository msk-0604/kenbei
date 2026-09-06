"use client";

import { useRef, useState, useTransition } from "react";
import { submitVoiceCaptureAction } from "@/features/capture/actions";

export function VoiceRecorder({ projectId }: { projectId: string }) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function begin() {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const file = new File([blob], "capture.webm", { type: blob.type });
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("audio", file);
      start(async () => {
        const result = await submitVoiceCaptureAction(data);
        if (result?.error) {
          setError(result.error);
        }
      });
    };
    mediaRef.current = recorder;
    recorder.start();
    setRecording(true);
    window.setTimeout(() => {
      if (mediaRef.current?.state === "recording") {
        mediaRef.current.stop();
        setRecording(false);
      }
    }, 60_000);
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {recording ? (
        <p className="text-lg font-medium text-red-600">録音中</p>
      ) : pending ? (
        <p className="text-lg font-medium text-zinc-700">整理しています</p>
      ) : (
        <p className="text-base text-zinc-600">話して報告します。最大1分です。</p>
      )}
      {recording ? (
        <button
          type="button"
          onClick={stop}
          className="h-32 w-32 rounded-full bg-red-600 text-lg font-semibold text-white"
        >
          停止
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            begin().catch(() => setError("マイクを許可してください。"));
          }}
          className="h-32 w-32 rounded-full bg-zinc-900 text-lg font-semibold text-white disabled:opacity-50"
        >
          {pending ? "処理中" : "話す"}
        </button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
