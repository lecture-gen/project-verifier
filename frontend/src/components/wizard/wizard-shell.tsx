"use client";

// 시안 B (Cinema Stepper) — 한 페이지처럼 보이지만 실제 라우팅은 없는 마법사 셸.
// 좌측 세로 stepper rail 은 page 수준에서 그리고, 이 컴포넌트는 우측 본문 패널만 담당한다.
// 구조: outcome 한 줄 → 큰 제목 → step 본문 (자체 스크롤) → 우측 하단 nav.
// 본문 영역만 내부 스크롤하며 페이지 자체 스크롤바는 노출되지 않는다.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { STAGE_META, type WizardStep } from "@/lib/wizard/state";

import { WizardNav } from "./wizard-nav";

export interface WizardShellProps {
  step: WizardStep;
  children: ReactNode;
  // 본문이 자체 form 일 때 outer scroll 영역과 충돌하지 않도록 padding 등을 조절하려는 stage 가 있다면 사용.
  className?: string;
}

export function WizardShell({ step, children, className }: WizardShellProps) {
  const meta = STAGE_META[step];

  return (
    <section
      key={step}
      data-stage={step}
      className={cn(
        // 우측 패널은 부모(h-dvh)의 남은 영역을 모두 차지하며 내부에서 column 분할.
        "flex h-full min-h-0 w-full flex-col px-6 py-8 md:px-12 md:py-10",
        // 좌→우 슬라이드 + opacity 인 트랜지션 (CSS-only, framer-motion 미사용)
        "animate-wizard-slide-in",
        className,
      )}
    >
      <header className="shrink-0 space-y-4 pb-6 md:pb-8">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.28em] text-muted-foreground">
          <span className="inline-flex h-1 w-1 rounded-full bg-foreground/40" />
          <span>이 단계가 끝나면</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/80 sm:text-base">
          {meta.outcome}
        </p>
        <div className="pt-2">
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {meta.title}
          </h2>
        </div>
      </header>

      {/* 본문 자체 스크롤 영역. 페이지 스크롤바는 숨김 (.no-scrollbar). */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-5 pb-4 md:space-y-6">{children}</div>
      </div>

      <WizardNav />
    </section>
  );
}
