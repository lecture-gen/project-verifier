"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  SpeechRecognizer,
  isSpeechRecognitionSupported,
} from "@/lib/audio/recognizer";

export interface MicButtonProps {
  // 최종 transcript 가 확정될 때마다 호출. interim 은 별도로 전달.
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  disabled?: boolean;
  lang?: string;
}

// 브라우저 capability 는 변하지 않으므로 subscribe 는 no-op.
function subscribeNoop(): () => void {
  return () => {};
}

export function MicButton({
  onFinalTranscript,
  onInterimTranscript,
  disabled,
  lang = "ko-KR",
}: MicButtonProps) {
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const [listening, setListening] = useState(false);
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => isSpeechRecognitionSupported(),
    () => false,
  );

  useEffect(() => {
    return () => {
      recognizerRef.current?.abort();
      recognizerRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      toast.error(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge 데스크톱에서 시도해 주세요.",
      );
      return;
    }
    try {
      const recognizer = new SpeechRecognizer({ lang, continuous: true });
      recognizer.onResult(({ finalTranscript, interimTranscript }) => {
        if (interimTranscript) onInterimTranscript?.(interimTranscript);
        if (finalTranscript) onFinalTranscript(finalTranscript);
      });
      recognizer.onError((message) => {
        toast.error(message);
        setListening(false);
      });
      recognizer.onEnd(() => {
        setListening(false);
      });
      recognizer.start();
      recognizerRef.current = recognizer;
      setListening(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "음성 인식을 시작할 수 없습니다.";
      toast.error(message);
    }
  }, [supported, lang, onFinalTranscript, onInterimTranscript]);

  const stop = useCallback(() => {
    recognizerRef.current?.stop();
  }, []);

  return (
    <Button
      type="button"
      variant={listening ? "destructive" : "outline"}
      onClick={listening ? stop : start}
      disabled={disabled || !supported}
      aria-pressed={listening}
      aria-label={listening ? "음성 입력 중지" : "음성으로 답하기"}
    >
      {listening ? <MicOff /> : <Mic />}
      {listening ? "녹음 중지" : "음성으로 답하기"}
    </Button>
  );
}
