// 단일 페이지 마법사용 stage 셸. 한 stage 의 [번호+제목+설명] 영역과 본문 영역을
// 위→아래(vertical) 로 배치하고, 전체 stage 가 사용자 viewport(100dvh) 안에 들어가도록
// 헤더/액션은 고정 영역, 본문 children 영역만 내부에서 y축 스크롤된다.
// 외곽 컨테이너(슬라이드/스냅)는 /create 페이지가 담당한다.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { WIZARD_STEP_TOTAL, type WizardStep } from "@/lib/wizard/state";

export interface WizardShellProps {
  step: WizardStep;
  title: string;
  description: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export function WizardShell({
  step,
  title,
  description,
  children,
  actions,
}: WizardShellProps) {
  const stepLabel = String(step).padStart(2, "0");
  const totalLabel = String(WIZARD_STEP_TOTAL).padStart(2, "0");

  return (
    <div
      className={cn(
        // 부모 section 이 h-full snap stage 이므로 여기서도 h-full 로 그 높이를 그대로 받아
        // header / 본문(스크롤) / actions 가 viewport 안에 정확히 들어가도록 한다.
        "flex h-full w-full flex-col gap-6 py-6 md:gap-8 md:py-8",
      )}
    >
      <aside className="flex shrink-0 flex-col gap-4 md:gap-6">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[3.5rem] leading-none tracking-tight text-foreground/90 sm:text-[4.5rem] md:text-[5.5rem]">
            {stepLabel}
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground sm:text-sm">
            {stepLabel} / {totalLabel}
          </span>
        </div>

        <header className="space-y-3">
          <h2 className="font-serif text-2xl leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl">
            {title}
          </h2>
          <div className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </div>
        </header>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col gap-6">
        {/* 본문 카드들이 viewport 를 넘기면 이 컨테이너 안에서만 y축 스크롤. */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 md:space-y-6 md:pr-2">
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-end md:pt-6">
            {actions}
          </div>
        )}
      </section>
    </div>
  );
}
