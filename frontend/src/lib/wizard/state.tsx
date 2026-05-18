"use client";

// 단일 페이지 마법사 상태. 메모리(React Context)에만 보관해 새로고침/재접속 시 1단계부터 다시 시작한다.
// sessionStorage/localStorage 의도적으로 사용하지 않음 (plan 결정사항).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
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

// 각 stage 가 우측 하단 [다음] 버튼을 통해 advance 하기 위해 등록하는 설정.
// stage 본문에서 useEffect 로 setAdvance(...) 하고 unmount 시 setAdvance(null) 한다.
export interface AdvanceConfig {
  onAdvance: () => void | Promise<void>;
  canAdvance: boolean;
  busy?: boolean;
  // 기본 "다음 단계" 라벨을 덮어쓸 때 사용. (예: "방을 만드는 중…")
  label?: string;
  // 마지막 stage 처럼 다음 버튼을 다른 의도로 쓸 때.
  hideBack?: boolean;
}

interface WizardState {
  evaluationId: string | null;
  currentStep: WizardStep;
  highestCompletedStep: 0 | WizardStep;
  info: WizardInfoDraft | null;
  policyDraft: WizardPolicyDraft | null;
}

interface WizardContextValue extends WizardState {
  setEvaluation: (evaluationId: string, info: WizardInfoDraft) => void;
  setPolicyDraft: (draft: WizardPolicyDraft) => void;
  markStepCompleted: (step: WizardStep) => void;
  goToStep: (step: WizardStep) => void;
  // 현재 활성 stage 의 advance 설정. shell 의 [다음 →] 버튼이 이 값을 사용한다.
  advance: AdvanceConfig | null;
  setAdvance: (config: AdvanceConfig | null) => void;
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
  const [advance, setAdvanceState] = useState<AdvanceConfig | null>(null);
  // 등록 순서 트래킹으로 stale unmount 가 새 stage 의 advance 를 지우지 않도록 한다.
  const advanceTokenRef = useRef(0);

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
      const upperBound = Math.min(
        prev.highestCompletedStep + 1,
        WIZARD_STEP_TOTAL,
      ) as WizardStep;
      const target = Math.min(Math.max(1, step), upperBound) as WizardStep;
      return { ...prev, currentStep: target };
    });
  }, []);

  const setAdvance = useCallback((config: AdvanceConfig | null) => {
    advanceTokenRef.current += 1;
    setAdvanceState(config);
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      ...state,
      setEvaluation,
      setPolicyDraft,
      markStepCompleted,
      goToStep,
      advance,
      setAdvance,
    }),
    [state, advance, setEvaluation, setPolicyDraft, markStepCompleted, goToStep, setAdvance],
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

// 좌측 rail / 우측 outcome 카피에 사용할 stage 메타데이터.
export interface StageMeta {
  // 좌측 rail 의 짧은 라벨 (한 단어 권장).
  label: string;
  // 우측 큰 제목.
  title: string;
  // 우측 상단 "이 단계가 끝나면 …" 한 줄 outcome.
  outcome: string;
}

export const STAGE_META: Record<WizardStep, StageMeta> = {
  1: {
    label: "정의",
    title: "방을 정의하세요.",
    outcome: "이 단계가 끝나면 방이 생성되고 평가 ID가 발급됩니다.",
  },
  2: {
    label: "자료",
    title: "자료를 받아 분석합니다.",
    outcome: "이 단계가 끝나면 zip이 분석되어 프로젝트 맥락이 만들어집니다.",
  },
  3: {
    label: "정책",
    title: "질문 정책을 정의합니다.",
    outcome: "이 단계가 끝나면 질문 생성에 쓰일 정책이 저장됩니다.",
  },
  4: {
    label: "검토",
    title: "질문을 미리 확인합니다.",
    outcome: "이 단계가 끝나면 생성된 질문 목록이 확정됩니다.",
  },
  5: {
    label: "공유",
    title: "학생에게 공유합니다.",
    outcome: "이 단계가 끝나면 학생 입장 URL과 비밀번호가 발급됩니다.",
  },
};
