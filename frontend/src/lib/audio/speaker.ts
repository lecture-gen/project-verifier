"use client";

// Web Speech API (SpeechSynthesis) wrapper.
// SpeechSynthesis 는 표준 API 라서 거의 모든 모던 브라우저가 지원하지만, 한국어 음성이
// 시스템에 없는 환경(예: 일부 Linux Chrome)에서는 fallback voice 가 자연스럽지 않다.

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  // voiceURI 지정 시 그 voice 를 우선 선택.
  preferredVoiceURI?: string;
}

// SpeechSynthesisVoice list 는 비동기로 로드된다. 첫 호출 시 비어 있을 수 있어 wait.
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const initial = synth.getVoices();
  if (initial.length > 0) return Promise.resolve(initial);
  return new Promise((resolve) => {
    const listener = () => {
      synth.removeEventListener("voiceschanged", listener);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", listener);
    // 일부 환경에서 voiceschanged 가 발생하지 않으므로 timeout 으로 한 번 더 시도.
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", listener);
      resolve(synth.getVoices());
    }, 1500);
  });
}

async function pickVoice(
  lang: string,
  preferredVoiceURI?: string,
): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (preferredVoiceURI) {
    const exact = voices.find((voice) => voice.voiceURI === preferredVoiceURI);
    if (exact) return exact;
  }
  const langPrefix = lang.split("-")[0];
  // ko-KR 정확 일치 → ko* prefix → 기본 voice 순.
  return (
    voices.find((voice) => voice.lang === lang) ??
    voices.find((voice) => voice.lang.startsWith(langPrefix)) ??
    voices.find((voice) => voice.default) ??
    null
  );
}

export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

export async function speak(
  text: string,
  options: SpeakOptions = {},
): Promise<void> {
  if (!isSpeechSynthesisSupported()) {
    throw new Error("이 브라우저는 음성 합성을 지원하지 않습니다.");
  }
  const trimmed = text.trim();
  if (!trimmed) return;

  const synth = window.speechSynthesis;
  synth.cancel(); // 이전 발화 정리.

  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = options.lang ?? "ko-KR";
  utterance.rate = options.rate ?? 1;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;

  const voice = await pickVoice(utterance.lang, options.preferredVoiceURI);
  if (voice) utterance.voice = voice;

  return new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) =>
      reject(new Error(`음성 합성 오류: ${event.error}`));
    synth.speak(utterance);
  });
}

export async function listAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return loadVoices();
}
