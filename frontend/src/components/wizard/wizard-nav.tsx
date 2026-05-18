"use client";

// 우측 하단 [← 이전][다음 →] 액션 바. 현재 stage 가 wizard state 에 등록한
// AdvanceConfig 를 바탕으로 다음 버튼의 활성/라벨/onClick 을 결정한다.
// 키보드 ←/→ 도 여기서 처리한다. input/textarea/select focus 중에는 무시.

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  useWizardState,
  WIZARD_STEP_TOTAL,
  type WizardStep,
} from "@/lib/wizard/state";

const FORM_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (FORM_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function WizardNav() {
  const {
    currentStep,
    highestCompletedStep,
    advance,
    goToStep,
  } = useWizardState();

  const canGoBack = currentStep > 1;
  const isLast = currentStep === WIZARD_STEP_TOTAL;
  const canAdvance = advance?.canAdvance ?? false;
  const busy = advance?.busy ?? false;
  const nextLabel = advance?.label ?? (isLast ? "완료" : "다음 단계");
  const hideBack = advance?.hideBack === true;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowRight") {
        if (advance && advance.canAdvance && !advance.busy) {
          event.preventDefault();
          void advance.onAdvance();
        } else if (!advance && currentStep < highestCompletedStep + 1) {
          // advance 가 등록되지 않은 stage(과거 step 재방문 등)에서는 forward 키만
          // 다음 step 으로 이동.
          const next = Math.min(
            currentStep + 1,
            WIZARD_STEP_TOTAL,
          ) as WizardStep;
          event.preventDefault();
          goToStep(next);
        }
      } else if (event.key === "ArrowLeft") {
        if (!canGoBack || hideBack) return;
        event.preventDefault();
        const prev = Math.max(1, currentStep - 1) as WizardStep;
        goToStep(prev);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, currentStep, highestCompletedStep, canGoBack, hideBack, goToStep]);

  function handleNext() {
    if (!advance || !advance.canAdvance || advance.busy) return;
    void advance.onAdvance();
  }

  function handleBack() {
    if (!canGoBack) return;
    const prev = Math.max(1, currentStep - 1) as WizardStep;
    goToStep(prev);
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 pt-4 md:pt-6">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">
          ←
        </kbd>
        <span>이전</span>
        <span className="text-border">·</span>
        <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">
          →
        </kbd>
        <span>다음</span>
      </div>
      <div className="flex items-center gap-2">
        {!hideBack && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={!canGoBack}
          >
            ← 이전
          </Button>
        )}
        <Button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance || busy}
        >
          {nextLabel}
          {!busy && !isLast && <span aria-hidden> →</span>}
        </Button>
      </div>
    </div>
  );
}
