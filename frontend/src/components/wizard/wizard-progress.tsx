"use client";

// 좌측 세로 stepper rail. 각 항목은 [번호 + 라벨 + 상태 dot] 으로 구성되며
// 완료/현재/대기 상태에 따라 시각적으로 다르게 표시된다.
// 클릭 가능 여부는 wizard state 의 goToStep 정책(이미 완료한 step + 1 까지)에 맞춰 disabled 한다.

import { cn } from "@/lib/utils";
import {
  STAGE_META,
  WIZARD_STEP_TOTAL,
  type WizardStep,
} from "@/lib/wizard/state";

interface WizardProgressProps {
  currentStep: WizardStep;
  highestCompletedStep: 0 | WizardStep;
  onJump: (step: WizardStep) => void;
}

export function WizardProgress({
  currentStep,
  highestCompletedStep,
  onJump,
}: WizardProgressProps) {
  const steps = Array.from(
    { length: WIZARD_STEP_TOTAL },
    (_, idx) => (idx + 1) as WizardStep,
  );

  return (
    <nav
      aria-label="마법사 진행 단계"
      className="flex h-full w-[200px] shrink-0 flex-col gap-2 border-r border-border/60 bg-muted/30 px-4 py-8 md:w-[240px] md:px-6"
    >
      <div className="mb-4 px-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
          새 평가 방
        </p>
        <p className="mt-1 font-serif text-lg leading-tight text-foreground">
          만들기
        </p>
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const meta = STAGE_META[step];
          const reachable = step <= highestCompletedStep + 1;
          const completed = step <= highestCompletedStep;
          const active = step === currentStep;
          return (
            <li key={step}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(step)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                  active && "bg-foreground/5",
                  !active && reachable && "hover:bg-foreground/5",
                  !reachable && "cursor-not-allowed opacity-50",
                )}
              >
                <StepDot step={step} active={active} completed={completed} />
                <span className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "font-mono text-[11px] tabular-nums tracking-[0.18em]",
                      active
                        ? "text-foreground"
                        : completed
                          ? "text-foreground/70"
                          : "text-muted-foreground",
                    )}
                  >
                    {String(step).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "text-sm leading-tight",
                      active
                        ? "font-medium text-foreground"
                        : completed
                          ? "text-foreground/80"
                          : "text-muted-foreground",
                    )}
                  >
                    {meta.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface StepDotProps {
  step: WizardStep;
  active: boolean;
  completed: boolean;
}

function StepDot({ step, active, completed }: StepDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono tabular-nums transition-colors",
        active && "border-foreground bg-foreground text-background",
        !active && completed && "border-foreground/70 bg-background text-foreground/70",
        !active && !completed && "border-border bg-background text-muted-foreground",
      )}
    >
      {completed && !active ? (
        <CheckIcon />
      ) : (
        <span>{String(step).padStart(2, "0")}</span>
      )}
      {active && (
        <span className="absolute -right-1 top-1/2 hidden h-px w-3 -translate-y-1/2 bg-foreground md:block" />
      )}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 6.5L4.8 8.8L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
