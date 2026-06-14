import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: SpeechRecognitionErrorEvent) => void);
  onresult: null | ((event: SpeechRecognitionEvent) => void);
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function useSpeechRecognition({ lang = "en-US" }: { lang?: string } = {}) {
  const Ctor = useMemo(() => getSpeechRecognitionCtor(), []);

  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const desiredListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const noSpeechCountRef = useRef(0);
  const noSpeechWindowTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIsSupported(Boolean(Ctor));
    if (!Ctor) setError("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const clearNoSpeechWindow = useCallback(() => {
    if (noSpeechWindowTimerRef.current) {
      window.clearTimeout(noSpeechWindowTimerRef.current);
      noSpeechWindowTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const stop = useCallback(() => {
    desiredListeningRef.current = false;
    clearRestartTimer();

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    setIsListening(false);
  }, [clearRestartTimer]);

  const initIfNeeded = useCallback(() => {
    if (!Ctor) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const recognition: SpeechRecognitionLike = new Ctor();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const chunk = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += chunk;
        else interimText += chunk;
      }

      setInterimTranscript(interimText);
      if (finalText.trim()) {
        setTranscript((prev) => (prev + " " + finalText).trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = String(event?.error || "");
      // "no-speech" is extremely common (silence timeout). Treat it as non-fatal.
      if (code === "no-speech") {
        noSpeechCountRef.current += 1;
        clearNoSpeechWindow();
        noSpeechWindowTimerRef.current = window.setTimeout(() => {
          noSpeechCountRef.current = 0;
          noSpeechWindowTimerRef.current = null;
        }, 8000);

        // Only surface a hint if this happens repeatedly.
        if (noSpeechCountRef.current >= 3) {
          setError("I'm not detecting speech—please speak closer to your mic and check your input device.");
        }
        return;
      }

      if (code === "aborted") return;

      // Fatal / user-actionable errors
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else if (code === "audio-capture") {
        setError("No microphone was found. Please connect a microphone and try again.");
      } else {
        setError(`Speech recognition error: ${code || "unknown"}`);
      }

      desiredListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      // Browsers often end the session after brief silence; auto-restart if user is still "recording".
      if (!desiredListeningRef.current) return;
      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // If restart fails due to invalid state, try once more later.
          clearRestartTimer();
          restartTimerRef.current = window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // give up
            }
          }, 1000);
        }
      }, 250);
    };

    return recognition;
  }, [Ctor, clearNoSpeechWindow, clearRestartTimer, lang]);

  const start = useCallback(async ({ resetTranscript = true }: { resetTranscript?: boolean } = {}) => {
    if (!Ctor) {
      setIsSupported(false);
      setError("Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    setError(null);
    if (resetTranscript) reset();
    clearRestartTimer();

    // Ask for mic permission explicitly (avoids silent failures in some browsers)
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError("Microphone permission is required. Please allow access and try again.");
      desiredListeningRef.current = false;
      setIsListening(false);
      return;
    }

    const recognition = initIfNeeded();
    if (!recognition) return;

    desiredListeningRef.current = true;
    noSpeechCountRef.current = 0;
    clearNoSpeechWindow();

    try {
      recognition.start();
    } catch {
      // If already started, stop and restart
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      try {
        recognition.start();
      } catch {
        setError("Failed to start voice recognition. Please try again.");
        desiredListeningRef.current = false;
      }
    }
  }, [Ctor, clearNoSpeechWindow, clearRestartTimer, initIfNeeded, reset]);

  useEffect(() => {
    return () => {
      desiredListeningRef.current = false;
      clearRestartTimer();
      clearNoSpeechWindow();
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [clearNoSpeechWindow, clearRestartTimer]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
