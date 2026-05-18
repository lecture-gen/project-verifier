"use client";

// Web Speech API (SpeechRecognition) wrapper.
// Chrome/Edge 는 표준 SpeechRecognition + webkit prefix 둘 다 지원.
// Safari 는 webkitSpeechRecognition 만 지원하거나 미지원.
// 미지원 환경에서는 명확한 메시지로 실패시킨다 (silent fallback 금지).

type SpeechResultListener = (event: {
  finalTranscript: string;
  interimTranscript: string;
}) => void;

type SpeechErrorListener = (message: string) => void;
type SpeechEndListener = () => void;

// vendored 타입: lib.dom 의 SpeechRecognition 타입은 환경에 따라 누락될 수 있다.
interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}
interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}
interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition;
}

function getRecognitionCtor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface SpeechRecognizerOptions {
  lang?: string;
  // 짧은 발화 후 자동 종료하지 않고 계속 듣고 싶을 때 true.
  continuous?: boolean;
}

export class SpeechRecognizer {
  private readonly recognition: BrowserSpeechRecognition;
  private resultListener: SpeechResultListener | null = null;
  private errorListener: SpeechErrorListener | null = null;
  private endListener: SpeechEndListener | null = null;
  private running = false;

  constructor(options: SpeechRecognizerOptions = {}) {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      throw new Error(
        "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 또는 Edge 데스크톱에서 다시 시도해 주세요.",
      );
    }
    const recognition = new Ctor();
    recognition.lang = options.lang ?? "ko-KR";
    recognition.continuous = options.continuous ?? true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscript += text;
        else interimTranscript += text;
      }
      this.resultListener?.({ finalTranscript, interimTranscript });
    };
    recognition.onerror = (event) => {
      this.errorListener?.(translateError(event.error, event.message));
    };
    recognition.onend = () => {
      this.running = false;
      this.endListener?.();
    };

    this.recognition = recognition;
  }

  onResult(listener: SpeechResultListener): void {
    this.resultListener = listener;
  }
  onError(listener: SpeechErrorListener): void {
    this.errorListener = listener;
  }
  onEnd(listener: SpeechEndListener): void {
    this.endListener = listener;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.recognition.start();
  }

  stop(): void {
    if (!this.running) return;
    this.recognition.stop();
  }

  abort(): void {
    this.recognition.abort();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}

function translateError(code: string, message: string | undefined): string {
  switch (code) {
    case "no-speech":
      return "발화가 감지되지 않았습니다. 다시 시도해 주세요.";
    case "audio-capture":
      return "마이크를 사용할 수 없습니다. 장치 연결을 확인해 주세요.";
    case "not-allowed":
    case "service-not-allowed":
      return "브라우저에서 마이크 권한이 거부되었습니다. 권한을 허용해 주세요.";
    case "network":
      return "음성 인식 서버와 통신에 실패했습니다.";
    case "aborted":
      return "음성 인식이 중단되었습니다.";
    default:
      return message || `음성 인식 오류 (${code}).`;
  }
}
