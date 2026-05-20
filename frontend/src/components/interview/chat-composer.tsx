"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { Mic, Send, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SpeechRecognizer,
  isSpeechRecognitionSupported,
} from "@/lib/audio/recognizer";

export interface ChatComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
  // 음성 인식 임시 문자열을 부모가 보고 싶을 때 사용. 없어도 동작에는 영향 없음.
  onInterimChange?: (interim: string) => void;
  lang?: string;
}

function subscribeNoop(): () => void {
  return () => {};
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isSubmitting = false,
  placeholder = "답변을 입력하세요. Shift+Enter 로 줄바꿈, Enter 로 전송.",
  onInterimChange,
  lang = "ko-KR",
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  // recognizer 의 onResult 콜백은 startListening 시점의 closure 를 잡는다.
  // 사용자가 발화 도중 멈췄다 다시 말할 때 다음 final transcript 가 도착하면 콜백 안의
  // value 가 stale 이라 직전 transcript 를 덮어쓰는 문제가 있었다. ref 로 최신값을 읽어 해결.
  const valueRef = useRef(value);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => isSpeechRecognitionSupported(),
    () => false,
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // textarea 높이 자동 조절: 1줄 ~ 5줄.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 5 * 24 + 16; // line-height 24px * 5줄 + padding 여유
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [value, interim]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.abort();
      recognizerRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    if (!supported) {
      toast.error(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome/Edge 데스크톱에서 시도해 주세요.",
      );
      return;
    }
    try {
      const recognizer = new SpeechRecognizer({ lang, continuous: true });
      recognizer.onResult(({ finalTranscript, interimTranscript }) => {
        if (interimTranscript) {
          setInterim(interimTranscript);
          onInterimChange?.(interimTranscript);
        }
        if (finalTranscript) {
          const trimmed = finalTranscript.trim();
          if (trimmed) {
            const current = valueRef.current;
            onChange(current ? `${current} ${trimmed}`.trim() : trimmed);
          }
          setInterim("");
          onInterimChange?.("");
        }
      });
      recognizer.onError((message) => {
        toast.error(message);
        setListening(false);
        setInterim("");
        onInterimChange?.("");
      });
      recognizer.onEnd(() => {
        setListening(false);
        setInterim("");
        onInterimChange?.("");
      });
      recognizer.start();
      recognizerRef.current = recognizer;
      setListening(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "음성 인식을 시작할 수 없습니다.";
      toast.error(message);
    }
  }, [supported, lang, onChange, onInterimChange]);

  const handleMicToggle = useCallback(() => {
    if (listening) stopListening();
    else startListening();
  }, [listening, startListening, stopListening]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!disabled && !isSubmitting && value.trim()) {
        onSubmit();
      }
    }
  };

  const canSend = !disabled && !isSubmitting && value.trim().length > 0;

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-border/70 bg-background px-2 py-2 shadow-sm",
        "focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20",
        disabled && "opacity-60",
      )}
    >
      <Button
        type="button"
        size="icon"
        variant={listening ? "destructive" : "ghost"}
        onClick={handleMicToggle}
        disabled={disabled || !supported}
        aria-pressed={listening}
        aria-label={listening ? "음성 입력 중지" : "음성으로 답하기"}
        className="h-9 w-9 shrink-0 rounded-full"
      >
        {listening ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      <div className="flex-1 self-stretch">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? "듣고 있어요. 말씀해 주세요." : placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "block w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none",
            "placeholder:text-muted-foreground/70 disabled:cursor-not-allowed",
          )}
        />
        {interim && (
          <p className="px-2 pb-1 text-xs text-muted-foreground">
            <span className="text-foreground/80">{interim}</span>
          </p>
        )}
      </div>

      <Button
        type="button"
        size="icon"
        variant="default"
        onClick={() => {
          if (canSend) onSubmit();
        }}
        disabled={!canSend}
        aria-label="답변 전송"
        className="h-9 w-9 shrink-0 rounded-full"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
