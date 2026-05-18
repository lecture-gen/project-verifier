// 단일 페이지 마법사용 stage 셸. 한 stage(섹션)의 좌우 2분할 editorial 레이아웃.
// 외곽 컨테이너(스크롤/슬라이드)는 /create 페이지가 담당하고, 이 컴포넌트는 stage 1개의 내용만 그린다.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { WIZARD_STEP_TOTAL, type WizardStep } from "@/lib/wizard/state";

export interface WizardShellProps {
  step: WizardStep;
  title: string;
  description: ReactNode;
  previousLabel?: string;
  nextLabel?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function WizardShell({
  step,
  title,
  description,
  previousLabel,
  nextLabel,
  children,
  actions,
}: WizardShellProps) {
  const stepLabel = String(step).padStart(2, "0");
  const totalLabel = String(WIZARD_STEP_TOTAL).padStart(2, "0");

  return (
    <div className="grid w-full grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-12 md:gap-16">
      <aside className="flex flex-col gap-10">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[5rem] leading-none tracking-tight text-foreground/90 md:text-[6.5rem]">
            {stepLabel}
          </span>
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            {stepLabel} / {totalLabel}
          </span>
        </div>

        <header className="space-y-4">
          <h2 className="font-serif text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
            {title}
          </h2>
          <div className="text-base leading-relaxed text-muted-foreground">
            {description}
          </div>
        </header>

        {(previousLabel || nextLabel) && (
          <footer className="mt-auto space-y-3 border-t border-border/60 pt-6 text-sm text-muted-foreground">
            {previousLabel && (
              <p>
                <span className="mr-2 uppercase tracking-[0.2em] text-muted-foreground/70">
                  이전
                </span>
                <span className="text-foreground/80">{previousLabel}</span>
              </p>
            )}
            {nextLabel && (
              <p>
                <span className="mr-2 uppercase tracking-[0.2em] text-muted-foreground/70">
                  다음
                </span>
                <span className="text-foreground/80">{nextLabel}</span>
              </p>
            )}
          </footer>
        )}
      </aside>

      <section className={cn("flex flex-col gap-8")}>
        <div className="space-y-6">{children}</div>
        {actions && (
          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-end">
            {actions}
          </div>
        )}
      </section>
    </div>
  );
}
