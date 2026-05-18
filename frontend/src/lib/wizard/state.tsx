"use client";

// 단일 페이지 마법사 상태. 메모리(React Context)에만 보관해 새로고침/재접속 시 1단계부터 다시 시작한다.
// sessionStorage/localStorage 의도적으로 사용하지 않음 (plan 결정사항).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const WIZARD_STEP_TOTAL = 5;
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardInfoDraft {
  room_name: string;
  project_name: string;
  candidate_name: string;
  description: string;
  // 학생 입장 비밀번호. 5단계 요약에서 보여주기 위해 보관한다.
  room_password: string;
}

export interface WizardPolicyDraft {
  total_question_count: number;
  bloom_ratios: Record<string, number>;
}

interface WizardState {
  evaluationId: string | null;
  // 현재 활성 stage 번호 (1~5).
  currentStep: WizardStep;
  // 완료한 최대 stage 번호 (0~5).
  highestCompletedStep: 0 | WizardStep;
  info: WizardInfoDraft | null;
  policyDraft: WizardPolicyDraft | null;
}

interface WizardContextValue extends WizardState {
  setEvaluation: (evaluationId: string, info: WizardInfoDraft) => void;
  setPolicyDraft: (draft: WizardPolicyDraft) => void;
  markStepCompleted: (step: WizardStep) => void;
  goToStep: (step: WizardStep) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

const INITIAL: WizardState = {
  evaluationId: null,
  currentStep: 1,
  highestCompletedStep: 0,
  info: null,
  policyDraft: null,
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(INITIAL);

  const setEvaluation = useCallback(
    (evaluationId: string, info: WizardInfoDraft) => {
      setState((prev) => ({
        ...prev,
        evaluationId,
        info,
        highestCompletedStep: Math.max(prev.highestCompletedStep, 1) as
          | 0
          | WizardStep,
        currentStep: prev.currentStep > 1 ? prev.currentStep : 2,
      }));
    },
    [],
  );

  const setPolicyDraft = useCallback((draft: WizardPolicyDraft) => {
    setState((prev) => ({ ...prev, policyDraft: draft }));
  }, []);

  const markStepCompleted = useCallback((step: WizardStep) => {
    setState((prev) => {
      const nextHighest = Math.max(prev.highestCompletedStep, step) as
        | 0
        | WizardStep;
      const nextCurrent = (step < WIZARD_STEP_TOTAL ? step + 1 : step) as WizardStep;
      return {
        ...prev,
        highestCompletedStep: nextHighest,
        currentStep: nextCurrent,
      };
    });
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => {
      // 이미 완료된 stage 또는 바로 다음 stage 까지만 이동 허용.
      const upperBound = Math.min(
        prev.highestCompletedStep + 1,
        WIZARD_STEP_TOTAL,
      ) as WizardStep;
      const target = Math.min(Math.max(1, step), upperBound) as WizardStep;
      return { ...prev, currentStep: target };
    });
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      ...state,
      setEvaluation,
      setPolicyDraft,
      markStepCompleted,
      goToStep,
    }),
    [state, setEvaluation, setPolicyDraft, markStepCompleted, goToStep],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizardState(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useWizardState must be used within WizardProvider");
  }
  return ctx;
}
