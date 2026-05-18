"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  cancelSpeech,
  isSpeechSynthesisSupported,
  speak,
} from "@/lib/audio/speaker";

export interface TtsButtonProps {
  text: string;
  // 자동재생 활성 시 text 변경마다 자동 호출.
  autoplay?: boolean;
  lang?: string;
  disabled?: boolean;
}

// 브라우저 capability 는 변하지 않으므로 subscribe 는 no-op.
function subscribeNoop(): () => void {
  return () => {};
}

export function TtsButton({
  text,
  autoplay = false,
  lang = "ko-KR",
  disabled,
}: TtsButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => isSpeechSynthesisSupported(),
    () => false,
  );

  const play = useCallback(async () => {
    if (!supported) {
      toast.error("이 브라우저는 음성 합성을 지원하지 않습니다.");
      return;
    }
    if (!text.trim()) return;
    try {
      setSpeaking(true);
      await speak(text, { lang });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "음성 재생에 실패했습니다.";
      toast.error(message);
    } finally {
      setSpeaking(false);
    }
  }, [supported, text, lang]);

  const stop = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  // autoplay: text 가 바뀌면 자동으로 한 번 재생.
  useEffect(() => {
    if (!autoplay) return;
    if (!supported) return;
    if (!text.trim()) return;
    // play() 안에서 setState 가 호출되므로 effect 본문이 아닌 마이크로태스크에서 트리거.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      play().catch(() => undefined);
    });
    return () => {
      cancelled = true;
      cancelSpeech();
    };
  }, [text, autoplay, supported, play]);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={speaking ? stop : play}
      disabled={disabled || !supported || !text.trim()}
      aria-pressed={speaking}
      aria-label={speaking ? "재생 중지" : "질문 음성 재생"}
    >
      {speaking ? <VolumeX /> : <Volume2 />}
      {speaking ? "재생 중지" : "음성 재생"}
    </Button>
  );
}
