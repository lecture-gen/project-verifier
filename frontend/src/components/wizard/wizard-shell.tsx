// 마법사 단계의 좌우 2분할 editorial 셸.
// 좌측: 큰 단계 번호 + 제목 + 본문 설명 + 이전/다음 단계 안내.
// 우측: 입력 폼이나 콘텐츠. 자식은 별도 카드 wrapper 없이 그대로 배치한다.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { WIZARD_STEP_TOTAL, type WizardStep } from "@/lib/wizard/state";

export interface WizardShellProps {
  step: WizardStep;
  title: string;
  description: ReactNode;
  // 좌측 하단에 노출되는 이전/다음 단계 라벨. 시연 흐름이 다음에 어디로 가는지 시각화한다.
  previousLabel?: string;
  nextLabel?: string;
  // 우측 본문. 폼·리스트·테이블 등.
  children: ReactNode;
  // 우측 본문 아래에 붙는 액션 row (제출, 다음 등).
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
    <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20">
      <aside className="flex flex-col gap-10 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[5rem] leading-none tracking-tight text-foreground/90 lg:text-[6.5rem]">
            {stepLabel}
          </span>
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            {stepLabel} / {totalLabel}
          </span>
        </div>

        <header className="space-y-4">
          <h1 className="font-serif text-3xl leading-tight tracking-tight text-foreground lg:text-4xl">
            {title}
          </h1>
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
