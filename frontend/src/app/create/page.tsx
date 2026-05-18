"use client";

// 단일 페이지 마법사. 5개 stage 를 한 페이지 안에서 Y축 슬라이드로 전환한다.
// sessionStorage/localStorage 를 사용하지 않으므로 새로고침 시 1단계부터 다시 시작한다.

import { useEffect, useRef } from "react";

import {
  Stage1Info,
  Stage2Upload,
  Stage3Policy,
  Stage4Questions,
  Stage5Summary,
} from "@/components/wizard/stages";
import { useWizardState, WIZARD_STEP_TOTAL, type WizardStep } from "@/lib/wizard/state";
import { cn } from "@/lib/utils";

const STAGES: Record<WizardStep, React.ComponentType> = {
  1: Stage1Info,
  2: Stage2Upload,
  3: Stage3Policy,
  4: Stage4Questions,
  5: Stage5Summary,
};

export default function CreateWizardPage() {
  const { currentStep, highestCompletedStep, goToStep } = useWizardState();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // currentStep 이 바뀔 때 활성 stage 상단으로 스크롤. transition 이 끝난 뒤 측정해야
  // 정확한 위치로 가므로 rAF 두 번 + scroll-margin 보정을 사용한다.
  useEffect(() => {
    const node = containerRef.current?.querySelector<HTMLElement>(
      `[data-stage="${currentStep}"]`,
    );
    if (!node) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [currentStep]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:py-8">
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          새 평가 방 만들기
        </p>
        <StepBreadcrumb
          currentStep={currentStep}
          highestCompletedStep={highestCompletedStep}
          onJump={goToStep}
        />
      </div>

      <div
        ref={containerRef}
        className="snap-y snap-mandatory space-y-16 md:space-y-24"
      >
        {(Object.keys(STAGES) as unknown as string[])
          .map((key) => Number(key) as WizardStep)
          .map((step) => {
            const Component = STAGES[step];
            const visible = step <= currentStep;
            const active = step === currentStep;
            return (
              <section
                key={step}
                data-stage={step}
                aria-hidden={!visible}
                // 한 stage 는 사용자 viewport 높이에 맞춰 한 화면을 차지한다.
                // scroll-mt 로 sticky/상단 여백 보정, scroll-snap 으로 step 단위 정렬.
                className={cn(
                  "flex min-h-[100dvh] snap-start scroll-mt-6 flex-col transition-all duration-500 ease-out",
                  visible
                    ? "translate-y-0 opacity-100"
                    : "pointer-events-none translate-y-8 opacity-0",
                  active ? "" : "opacity-70",
                )}
              >
                {visible && <Component />}
              </section>
            );
          })}
      </div>
    </main>
  );
}

function StepBreadcrumb({
  currentStep,
  highestCompletedStep,
  onJump,
}: {
  currentStep: WizardStep;
  highestCompletedStep: 0 | WizardStep;
  onJump: (step: WizardStep) => void;
}) {
  return (
    <ol className="flex items-center gap-1.5 text-xs">
      {Array.from({ length: WIZARD_STEP_TOTAL }, (_, idx) => (idx + 1) as WizardStep).map(
        (step) => {
          const reachable = step <= highestCompletedStep + 1;
          const active = step === currentStep;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(step)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-mono tabular-nums transition-colors",
                  active
                    ? "border-foreground bg-foreground text-background"
                    : reachable
                      ? "border-border text-foreground hover:bg-muted"
                      : "border-border/50 text-muted-foreground/50",
                )}
              >
                {String(step).padStart(2, "0")}
              </button>
            </li>
          );
        },
      )}
    </ol>
  );
}
