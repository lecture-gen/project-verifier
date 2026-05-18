"use client";

// 단일 페이지 마법사 — 시안 B (Cinema Stepper).
// 좌측 세로 stepper rail + 우측 컨텐츠 패널. 현재 step 1 개만 DOM 에 mount 된다.
// 페이지 전체는 h-dvh + overflow-hidden 으로 viewport 에 고정되어 스크롤바가 노출되지 않는다.
// 새로고침 시 1단계부터 다시 시작 (메모리 전용).

import {
  Stage1Info,
  Stage2Upload,
  Stage3Policy,
  Stage4Questions,
  Stage5Summary,
} from "@/components/wizard/stages";
import { WizardProgress } from "@/components/wizard/wizard-progress";
import { useWizardState, type WizardStep } from "@/lib/wizard/state";

const STAGES: Record<WizardStep, React.ComponentType> = {
  1: Stage1Info,
  2: Stage2Upload,
  3: Stage3Policy,
  4: Stage4Questions,
  5: Stage5Summary,
};

export default function CreateWizardPage() {
  const { currentStep, highestCompletedStep, goToStep } = useWizardState();
  const Active = STAGES[currentStep];

  return (
    <main className="grid h-full w-full grid-cols-[auto_1fr] overflow-hidden">
      <WizardProgress
        currentStep={currentStep}
        highestCompletedStep={highestCompletedStep}
        onJump={goToStep}
      />
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        {/* key 를 currentStep 으로 두어 step 전환 시 컴포넌트가 remount → CSS 슬라이드 인 트랜지션이 다시 재생된다. */}
        <Active key={currentStep} />
      </div>
    </main>
  );
}
