import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UseElevenLabsTranscribeResult {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export function useElevenLabsTranscribe(): UseElevenLabsTranscribeResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = { current: null as MediaRecorder | null };
  const chunksRef = { current: [] as Blob[] };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (audioBlob.size < 1000) {
          setError("Recording too short—please try again.");
          return;
        }

        setIsTranscribing(true);

        try {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const retryDelays = [700, 1400, 2500];
          let transcriptText = "";
          let lastErr: unknown = null;

          for (let attempt = 0; attempt < retryDelays.length; attempt++) {
            const { data, error: funcError } = await supabase.functions.invoke(
              "elevenlabs-transcribe",
              { body: formData }
            );

            if (!funcError && !data?.error) {
              transcriptText = data?.text ?? "";
              break;
            }

            lastErr = funcError || new Error(data?.error || "Transcription failed");
            const msg = (funcError?.message || data?.error || "").toLowerCase();
            const shouldRetry = msg.includes('429') || msg.includes('rate') || msg.includes('5');
            if (!shouldRetry || attempt === retryDelays.length - 1) break;
            await wait(retryDelays[attempt]);
          }

          if (!transcriptText && lastErr) {
            throw lastErr instanceof Error ? lastErr : new Error("Transcription failed");
          }

          setTranscript(transcriptText);
        } catch (err) {
          console.error("Transcription failed:", err);
          const message = err instanceof Error ? err.message : "Transcription failed";
          const friendly = message.toLowerCase().includes('rate')
            ? "Transcription service is busy. Please try again in a few seconds."
            : message;
          setError(friendly);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access error:", err);
      setError("Microphone permission required. Please allow access and try again.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
  };
}
