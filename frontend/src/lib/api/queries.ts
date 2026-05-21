// TanStack Query v5 기반 read hooks.
// admin password 게이트는 제거되어, evaluation 단위 read 는 evaluationId 만으로 동작한다.
// silent fallback 금지 — error 는 그대로 surface.

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

import {
  getContext,
  getEvaluation,
  getEvaluationStatus,
  getInterviewState,
  getLatestReport,
  getQualityAssessment,
  getReport,
  listArtifacts,
  listEvaluationReports,
  listEvaluationSessions,
  listEvaluations,
  listQuestionsAsAdmin,
  listQuestionsAsParticipant,
  listTurns,
  type EvaluationReportRead,
  type ExtractedProjectContextRead,
  type InterviewQuestionRead,
  type InterviewSessionRead,
  type InterviewTurnRead,
  type ProjectArtifactRead,
  type ProjectEvaluationRead,
  type ProjectEvaluationStatusRead,
  type ProjectEvaluationSummaryRead,
  type ProjectQualityAssessmentRead,
  type StudentInterviewStateRead,
} from "./endpoints";

// ---------- queryKey 규약 ----------

export const evaluationKeys = {
  all: ["evaluation"] as const,
  lists: () => [...evaluationKeys.all, "list"] as const,
  detail: (id: string) => [...evaluationKeys.all, id, "detail"] as const,
  status: (id: string) => [...evaluationKeys.all, id, "status"] as const,
  artifacts: (id: string) => [...evaluationKeys.all, id, "artifacts"] as const,
  context: (id: string) => [...evaluationKeys.all, id, "context"] as const,
  qualityAssessment: (id: string) =>
    [...evaluationKeys.all, id, "quality-assessment"] as const,
  questions: (id: string) => [...evaluationKeys.all, id, "questions"] as const,
  sessionsList: (id: string) => [...evaluationKeys.all, id, "sessions", "list"] as const,
  reportsList: (id: string) => [...evaluationKeys.all, id, "reports", "list"] as const,
  latestReport: (id: string) => [...evaluationKeys.all, id, "reports", "latest"] as const,
  report: (id: string, reportId: string) =>
    [...evaluationKeys.all, id, "reports", reportId] as const,
  session: (id: string, sessionId: string) =>
    [...evaluationKeys.all, id, "session", sessionId] as const,
  sessionState: (id: string, sessionId: string) =>
    [...evaluationKeys.session(id, sessionId), "state"] as const,
  sessionTurns: (id: string, sessionId: string) =>
    [...evaluationKeys.session(id, sessionId), "turns"] as const,
};

type QueryExtras<TData> = Omit<
  UseQueryOptions<TData, Error, TData>,
  "queryKey" | "queryFn"
>;

// ---------- admin queries ----------

export function useEvaluationList(options?: QueryExtras<ProjectEvaluationSummaryRead[]>) {
  return useQuery<ProjectEvaluationSummaryRead[], Error>({
    queryKey: evaluationKeys.lists(),
    queryFn: () => listEvaluations(),
    ...options,
  });
}

export function useEvaluation(
  evaluationId: string | null | undefined,
  options?: QueryExtras<ProjectEvaluationRead>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<ProjectEvaluationRead, Error>({
    queryKey: evaluationKeys.detail(evaluationId ?? ""),
    queryFn: () => getEvaluation(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useEvaluationStatus(
  evaluationId: string | null | undefined,
  options?: QueryExtras<ProjectEvaluationStatusRead>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<ProjectEvaluationStatusRead, Error>({
    queryKey: evaluationKeys.status(evaluationId ?? ""),
    queryFn: () => getEvaluationStatus(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useArtifacts(
  evaluationId: string | null | undefined,
  options?: QueryExtras<ProjectArtifactRead[]>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<ProjectArtifactRead[], Error>({
    queryKey: evaluationKeys.artifacts(evaluationId ?? ""),
    queryFn: () => listArtifacts(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useExtractedContext(
  evaluationId: string | null | undefined,
  options?: QueryExtras<ExtractedProjectContextRead>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<ExtractedProjectContextRead, Error>({
    queryKey: evaluationKeys.context(evaluationId ?? ""),
    queryFn: () => getContext(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useQualityAssessment(
  evaluationId: string | null | undefined,
  options?: QueryExtras<ProjectQualityAssessmentRead>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<ProjectQualityAssessmentRead, Error>({
    queryKey: evaluationKeys.qualityAssessment(evaluationId ?? ""),
    queryFn: () => getQualityAssessment(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useAdminQuestions(
  evaluationId: string | null | undefined,
  options?: QueryExtras<InterviewQuestionRead[]>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<InterviewQuestionRead[], Error>({
    queryKey: evaluationKeys.questions(evaluationId ?? ""),
    queryFn: () => listQuestionsAsAdmin(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useEvaluationSessions(
  evaluationId: string | null | undefined,
  options?: QueryExtras<InterviewSessionRead[]>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<InterviewSessionRead[], Error>({
    queryKey: evaluationKeys.sessionsList(evaluationId ?? ""),
    queryFn: () => listEvaluationSessions(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useEvaluationReports(
  evaluationId: string | null | undefined,
  options?: QueryExtras<EvaluationReportRead[]>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<EvaluationReportRead[], Error>({
    queryKey: evaluationKeys.reportsList(evaluationId ?? ""),
    queryFn: () => listEvaluationReports(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useLatestReport(
  evaluationId: string | null | undefined,
  options?: QueryExtras<EvaluationReportRead>,
) {
  const enabled = Boolean(evaluationId);
  return useQuery<EvaluationReportRead, Error>({
    queryKey: evaluationKeys.latestReport(evaluationId ?? ""),
    queryFn: () => getLatestReport(evaluationId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useReport(
  evaluationId: string | null | undefined,
  reportId: string | null | undefined,
  options?: QueryExtras<EvaluationReportRead>,
) {
  const enabled = Boolean(evaluationId && reportId);
  return useQuery<EvaluationReportRead, Error>({
    queryKey: evaluationKeys.report(evaluationId ?? "", reportId ?? ""),
    queryFn: () => getReport(evaluationId!, reportId!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

// ---------- participant queries ----------

export function useParticipantQuestions(
  evaluationId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionToken: string | null | undefined,
  options?: QueryExtras<InterviewQuestionRead[]>,
) {
  const enabled = Boolean(evaluationId && sessionId && sessionToken);
  return useQuery<InterviewQuestionRead[], Error>({
    queryKey: evaluationKeys.questions(evaluationId ?? ""),
    queryFn: () =>
      listQuestionsAsParticipant(evaluationId!, sessionId!, sessionToken!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useInterviewState(
  evaluationId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionToken: string | null | undefined,
  options?: QueryExtras<StudentInterviewStateRead>,
) {
  const enabled = Boolean(evaluationId && sessionId && sessionToken);
  return useQuery<StudentInterviewStateRead, Error>({
    queryKey: evaluationKeys.sessionState(evaluationId ?? "", sessionId ?? ""),
    queryFn: () => getInterviewState(evaluationId!, sessionId!, sessionToken!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useSessionTurns(
  evaluationId: string | null | undefined,
  sessionId: string | null | undefined,
  sessionToken: string | null | undefined,
  options?: QueryExtras<InterviewTurnRead[]>,
) {
  const enabled = Boolean(evaluationId && sessionId && sessionToken);
  return useQuery<InterviewTurnRead[], Error>({
    queryKey: evaluationKeys.sessionTurns(evaluationId ?? "", sessionId ?? ""),
    queryFn: () => listTurns(evaluationId!, sessionId!, sessionToken!),
    enabled: enabled && (options?.enabled ?? true),
    ...options,
  });
}
