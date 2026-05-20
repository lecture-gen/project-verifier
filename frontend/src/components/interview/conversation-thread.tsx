"use client";

import { useEffect, useRef } from "react";

import { TtsButton } from "@/components/audio/tts-button";
import { cn } from "@/lib/utils";

export type ConversationRole = "assistant" | "user";

export interface ConversationMessage {
  key: string;
  role: ConversationRole;
  text: string;
  subtext?: string;
  meta?: string;
  pending?: boolean;
}

interface ConversationThreadProps {
  messages: ConversationMessage[];
  emptyState?: string;
  className?: string;
}

export function ConversationThread({
  messages,
  emptyState = "아직 대화가 없습니다.",
  className,
}: ConversationThreadProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const lastKey = messages.length > 0 ? messages[messages.length - 1].key : null;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lastKey]);

  if (messages.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/60 bg-muted/30 px-5 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      aria-live="polite"
      className={cn(
        "flex flex-col gap-4 overflow-y-auto rounded-2xl border border-border/60 bg-card/60 px-4 py-5 sm:px-6",
        className,
      )}
    >
      {messages.map((message) => (
        <MessageBubble key={message.key} message={message} />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const isAssistant = message.role === "assistant";
  const ttsReady = isAssistant && !message.pending && message.text.trim().length > 0;
  return (
    <div
      className={cn(
        "flex w-full items-end gap-2",
        isAssistant ? "justify-start" : "justify-end",
      )}
    >
      {isAssistant && <Avatar role={message.role} />}
      <div
        className={cn(
          "flex max-w-[82%] flex-col gap-1 rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[78%]",
          isAssistant
            ? "rounded-bl-md border border-border/60 bg-background text-foreground"
            : "rounded-br-md bg-primary text-primary-foreground",
          message.pending && "opacity-80",
        )}
      >
        {message.meta && (
          <span
            className={cn(
              "text-[0.65rem] font-medium uppercase tracking-[0.18em]",
              isAssistant ? "text-muted-foreground" : "text-primary-foreground/70",
            )}
          >
            {message.meta}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words">
          {message.text || (
            <span
              className={cn(
                "italic",
                isAssistant ? "text-muted-foreground" : "text-primary-foreground/80",
              )}
            >
              {message.pending ? "답변을 기다리는 중…" : "(내용 없음)"}
            </span>
          )}
        </p>
        {message.subtext && (
          <p
            className={cn(
              "text-xs",
              isAssistant ? "text-muted-foreground" : "text-primary-foreground/80",
            )}
          >
            {message.subtext}
          </p>
        )}
        {ttsReady && (
          <div className="mt-1 flex">
            <TtsButton text={message.text} iconOnly />
          </div>
        )}
      </div>
      {!isAssistant && <Avatar role={message.role} />}
    </div>
  );
}

function Avatar({ role }: { role: ConversationRole }) {
  const isAssistant = role === "assistant";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full border text-[0.7rem] font-semibold uppercase tracking-wider",
        isAssistant
          ? "border-border/60 bg-muted text-muted-foreground"
          : "border-primary/30 bg-primary/10 text-primary",
      )}
    >
      {isAssistant ? "AI" : "나"}
    </span>
  );
}
