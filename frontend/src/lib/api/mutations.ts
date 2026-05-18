// TanStack Query v5 기반 write hooks. 성공 시 관련 queryKey 만 좁게 invalidate 한다.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  abortInterview,
  completeInterview,
  completeSession,
  createEvaluation,
  createSession,
  extractContext,
  generateQuestions,
  joinEvaluation,
  submitInterviewAnswer,
  submitTurn,
  updateQuestionPolicy,
  uploadZipArtifact,
  type ArtifactUploadResult,
  type EvaluationReportRead,
  type ExtractedProjectContextRead,
  type InterviewQuestionRead,
  type InterviewSessionRead,
  type InterviewTurnCreate,
  type InterviewTurnFlowRequest,
  type InterviewTurnFlowResponse,
  type InterviewTurnRead,
  type JoinEvaluationRead,
  type JoinEvaluationRequest,
  type ProjectEvaluationCreate,
  type ProjectEvaluationRead,
  type QuestionPolicyUpdate,
} from "./endpoints";
import { evaluationKeys } from "./queries";

export function useCreateEvaluation() {
  const qc = useQueryClient();
  return useMutation<ProjectEvaluationRead, Error, ProjectEvaluationCreate>({
    mutationFn: (payload) => createEvaluation(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.lists() });
    },
  });
}

export function useUpdateQuestionPolicy(evaluationId: string) {
  const qc = useQueryClient();
  return useMutation<ProjectEvaluationRead, Error, QuestionPolicyUpdate>({
    mutationFn: (payload) => updateQuestionPolicy(evaluationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.detail(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useUploadZipArtifact(evaluationId: string) {
  const qc = useQueryClient();
  return useMutation<ArtifactUploadResult, Error, { file: File; signal?: AbortSignal }>({
    mutationFn: ({ file, signal }) => uploadZipArtifact(evaluationId, file, signal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.artifacts(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useExtractContext(evaluationId: string) {
  const qc = useQueryClient();
  return useMutation<ExtractedProjectContextRead, Error, void>({
    mutationFn: () => extractContext(evaluationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.context(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useGenerateQuestions(evaluationId: string) {
  const qc = useQueryClient();
  return useMutation<InterviewQuestionRead[], Error, void>({
    mutationFn: () => generateQuestions(evaluationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.questions(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useJoinEvaluation(evaluationId: string) {
  return useMutation<JoinEvaluationRead, Error, JoinEvaluationRequest>({
    mutationFn: (payload) => joinEvaluation(evaluationId, payload),
  });
}

export function useCreateSession(evaluationId: string) {
  return useMutation<InterviewSessionRead, Error, void>({
    mutationFn: () => createSession(evaluationId),
  });
}

export function useSubmitTurn(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
) {
  const qc = useQueryClient();
  return useMutation<InterviewTurnRead, Error, InterviewTurnCreate>({
    mutationFn: (payload) =>
      submitTurn(evaluationId, sessionId, payload, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: evaluationKeys.sessionTurns(evaluationId, sessionId),
      });
      qc.invalidateQueries({
        queryKey: evaluationKeys.sessionState(evaluationId, sessionId),
      });
    },
  });
}

export function useSubmitInterviewAnswer(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
) {
  const qc = useQueryClient();
  return useMutation<InterviewTurnFlowResponse, Error, InterviewTurnFlowRequest>({
    mutationFn: (payload) =>
      submitInterviewAnswer(evaluationId, sessionId, payload, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: evaluationKeys.sessionState(evaluationId, sessionId),
      });
      qc.invalidateQueries({
        queryKey: evaluationKeys.sessionTurns(evaluationId, sessionId),
      });
    },
  });
}

export function useCompleteInterview(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
) {
  const qc = useQueryClient();
  return useMutation<EvaluationReportRead, Error, void>({
    mutationFn: () => completeInterview(evaluationId, sessionId, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.latestReport(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useAbortInterview(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
) {
  const qc = useQueryClient();
  return useMutation<EvaluationReportRead, Error, void>({
    mutationFn: () => abortInterview(evaluationId, sessionId, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.latestReport(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}

export function useCompleteSession(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
) {
  const qc = useQueryClient();
  return useMutation<EvaluationReportRead, Error, void>({
    mutationFn: () => completeSession(evaluationId, sessionId, sessionToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: evaluationKeys.latestReport(evaluationId) });
      qc.invalidateQueries({ queryKey: evaluationKeys.status(evaluationId) });
    },
  });
}
