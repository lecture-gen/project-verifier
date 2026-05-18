// 백엔드 /api/project-evaluations 엔드포인트의 thin wrapper.
// 응답/요청 타입은 openapi-typescript 가 생성한 types.gen.ts 의 components.schemas 를 그대로 사용한다.

import type { components } from "./types.gen";
import { apiFetch, apiFetchRaw, type ApiAuth } from "./client";
import type { ExtractedProjectContext } from "./context-types";

export type {
  Architecture,
  ArchitectureEdge,
  ArchitectureNode,
  DependencyEntry,
  ExtractedProjectContext,
  FileTreeNode,
  LanguageLoc,
  ProjectAreaContext,
  ReadmeOutlineEntry,
  StructuralFacts,
  StudentImplementationRisk,
  TechStackItem,
} from "./context-types";

// ---------- 도메인 타입 alias ----------

type Schemas = components["schemas"];

export type ProjectEvaluationCreate = Schemas["ProjectEvaluationCreate"];
export type ProjectEvaluationRead = Schemas["ProjectEvaluationRead"];
export type ProjectEvaluationSummaryRead = Schemas["ProjectEvaluationSummaryRead"];
export type ProjectEvaluationStatusRead = Schemas["ProjectEvaluationStatusRead"];
export type EvaluationStatus = Schemas["EvaluationStatus"];

export type JoinEvaluationRequest = Schemas["JoinEvaluationRequest"];
export type JoinEvaluationRead = Schemas["JoinEvaluationRead"];

export type ArtifactUploadResult = Schemas["ArtifactUploadResult"];
export type ProjectArtifactRead = Schemas["ProjectArtifactRead"];

// ExtractedProjectContextRead 는 백엔드 ProjectContextSchema 가 재정의된 이후의 형태를
// 따른다. OpenAPI 재생성 전에는 types.gen.ts 가 옛 schema 를 그대로 가지고 있으므로,
// 신규 필드(architecture, student_implementation_risks, structural_facts 등)는
// context-types.ts 의 ExtractedProjectContext 타입을 사용한다.
export type ExtractedProjectContextRead = ExtractedProjectContext;

export type QuestionPolicyUpdate = Schemas["QuestionPolicyUpdate"];
export type QuestionGenerationPolicy = Schemas["QuestionGenerationPolicy"];
export type InterviewQuestionRead = Schemas["InterviewQuestionRead"];
export type BloomLevel = Schemas["BloomLevel"];
export type Difficulty = Schemas["Difficulty"];

export type InterviewSessionRead = Schemas["InterviewSessionRead"];
export type InterviewSessionStatus = Schemas["InterviewSessionStatus"];
export type InterviewTurnRead = Schemas["InterviewTurnRead"];
export type InterviewTurnCreate = Schemas["InterviewTurnCreate"];
export type InterviewTurnFlowRequest = Schemas["InterviewTurnFlowRequest"];
export type InterviewTurnFlowResponse = Schemas["InterviewTurnFlowResponse"];
export type InterviewTurnFlowStatus = Schemas["InterviewTurnFlowStatus"];
export type InterviewTurnMode = Schemas["InterviewTurnMode"];

export type StudentInterviewStateRead = Schemas["StudentInterviewStateRead"];
export type InterviewTranscriptionRead = Schemas["InterviewTranscriptionRead"];
export type InterviewSpeechSynthesisRequest = Schemas["InterviewSpeechSynthesisRequest"];

export type EvaluationReportRead = Schemas["EvaluationReportRead"];
export type FinalDecision = Schemas["FinalDecision"];
export type RubricCriterion = Schemas["RubricCriterion"];
export type RubricScoreItem = Schemas["RubricScoreItem"];
export type SourceReference = Schemas["SourceReference"];

// ---------- helpers ----------

const BASE = "/api/project-evaluations";

function sessionAuth(
  sessionId: string | null | undefined,
  sessionToken: string | null | undefined,
): ApiAuth {
  return { sessionId: sessionId ?? null, sessionToken: sessionToken ?? null };
}

// ---------- evaluation ----------

export function listEvaluations(): Promise<ProjectEvaluationSummaryRead[]> {
  return apiFetch<ProjectEvaluationSummaryRead[]>(BASE);
}

export function createEvaluation(
  payload: ProjectEvaluationCreate,
): Promise<ProjectEvaluationRead> {
  return apiFetch<ProjectEvaluationRead>(BASE, { method: "POST", body: payload });
}

export function getEvaluation(
  evaluationId: string,
): Promise<ProjectEvaluationRead> {
  return apiFetch<ProjectEvaluationRead>(`${BASE}/${evaluationId}`);
}

export function getEvaluationStatus(
  evaluationId: string,
): Promise<ProjectEvaluationStatusRead> {
  return apiFetch<ProjectEvaluationStatusRead>(`${BASE}/${evaluationId}/status`);
}

export function updateQuestionPolicy(
  evaluationId: string,
  payload: QuestionPolicyUpdate,
): Promise<ProjectEvaluationRead> {
  return apiFetch<ProjectEvaluationRead>(`${BASE}/${evaluationId}/question-policy`, {
    method: "PATCH",
    body: payload,
  });
}

// ---------- artifacts / context ----------

export function uploadZipArtifact(
  evaluationId: string,
  file: File,
  signal?: AbortSignal,
): Promise<ArtifactUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  return apiFetch<ArtifactUploadResult>(`${BASE}/${evaluationId}/artifacts/zip`, {
    method: "POST",
    body: form,
    signal,
  });
}

export function listArtifacts(
  evaluationId: string,
): Promise<ProjectArtifactRead[]> {
  return apiFetch<ProjectArtifactRead[]>(`${BASE}/${evaluationId}/artifacts`);
}

export function extractContext(
  evaluationId: string,
): Promise<ExtractedProjectContextRead> {
  return apiFetch<ExtractedProjectContextRead>(`${BASE}/${evaluationId}/extract`, {
    method: "POST",
  });
}

export function getContext(
  evaluationId: string,
): Promise<ExtractedProjectContextRead> {
  return apiFetch<ExtractedProjectContextRead>(`${BASE}/${evaluationId}/context`);
}

// ---------- questions ----------

export function generateQuestions(
  evaluationId: string,
): Promise<InterviewQuestionRead[]> {
  return apiFetch<InterviewQuestionRead[]>(`${BASE}/${evaluationId}/questions/generate`, {
    method: "POST",
  });
}

export function listQuestionsAsAdmin(
  evaluationId: string,
): Promise<InterviewQuestionRead[]> {
  return apiFetch<InterviewQuestionRead[]>(`${BASE}/${evaluationId}/questions`);
}

export function listQuestionsAsParticipant(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
): Promise<InterviewQuestionRead[]> {
  return apiFetch<InterviewQuestionRead[]>(
    `${BASE}/${evaluationId}/questions`,
    sessionAuth(sessionId, sessionToken),
  );
}

// ---------- sessions / interview ----------

export function joinEvaluation(
  evaluationId: string,
  payload: JoinEvaluationRequest,
): Promise<JoinEvaluationRead> {
  return apiFetch<JoinEvaluationRead>(`${BASE}/${evaluationId}/join`, {
    method: "POST",
    body: payload,
  });
}

export function createSession(
  evaluationId: string,
): Promise<InterviewSessionRead> {
  return apiFetch<InterviewSessionRead>(`${BASE}/${evaluationId}/sessions`, {
    method: "POST",
  });
}

export function listTurns(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
): Promise<InterviewTurnRead[]> {
  return apiFetch<InterviewTurnRead[]>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/turns`,
    sessionAuth(null, sessionToken),
  );
}

export function submitTurn(
  evaluationId: string,
  sessionId: string,
  payload: InterviewTurnCreate,
  sessionToken: string,
): Promise<InterviewTurnRead> {
  return apiFetch<InterviewTurnRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/turns`,
    { method: "POST", body: payload, ...sessionAuth(null, sessionToken) },
  );
}

export function getInterviewState(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
  options: { internal?: boolean; signal?: AbortSignal } = {},
): Promise<StudentInterviewStateRead> {
  return apiFetch<StudentInterviewStateRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/state`,
    { ...sessionAuth(null, sessionToken), ...options },
  );
}

export function transcribeInterviewAudio(
  evaluationId: string,
  sessionId: string,
  audio: Blob,
  filename: string,
  mode: InterviewTurnMode,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<InterviewTranscriptionRead> {
  const form = new FormData();
  form.append("audio", audio, filename);
  form.append("mode", mode);
  return apiFetch<InterviewTranscriptionRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/transcribe`,
    { method: "POST", body: form, signal, ...sessionAuth(null, sessionToken) },
  );
}

export function submitInterviewAnswer(
  evaluationId: string,
  sessionId: string,
  payload: InterviewTurnFlowRequest,
  sessionToken: string,
): Promise<InterviewTurnFlowResponse> {
  return apiFetch<InterviewTurnFlowResponse>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/answer`,
    { method: "POST", body: payload, ...sessionAuth(null, sessionToken) },
  );
}

export function completeInterview(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
): Promise<EvaluationReportRead> {
  return apiFetch<EvaluationReportRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/complete`,
    { method: "POST", ...sessionAuth(null, sessionToken) },
  );
}

export function abortInterview(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
): Promise<EvaluationReportRead> {
  return apiFetch<EvaluationReportRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/abort`,
    { method: "POST", ...sessionAuth(null, sessionToken) },
  );
}

export function completeSession(
  evaluationId: string,
  sessionId: string,
  sessionToken: string,
  options: { internal?: boolean; signal?: AbortSignal } = {},
): Promise<EvaluationReportRead> {
  return apiFetch<EvaluationReportRead>(
    `${BASE}/${evaluationId}/sessions/${sessionId}/complete`,
    { method: "POST", ...sessionAuth(null, sessionToken), ...options },
  );
}

// TTS 응답은 audio/mpeg 스트림이므로 raw Response 를 돌려준다.
export function synthesizeInterviewSpeech(
  evaluationId: string,
  sessionId: string,
  payload: InterviewSpeechSynthesisRequest,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<Response> {
  return apiFetchRaw(
    `${BASE}/${evaluationId}/sessions/${sessionId}/interview/tts`,
    { method: "POST", body: payload, signal, ...sessionAuth(null, sessionToken) },
  );
}

// ---------- reports ----------

export function getLatestReport(
  evaluationId: string,
): Promise<EvaluationReportRead> {
  return apiFetch<EvaluationReportRead>(`${BASE}/${evaluationId}/reports/latest`);
}

export function getReport(
  evaluationId: string,
  reportId: string,
): Promise<EvaluationReportRead> {
  return apiFetch<EvaluationReportRead>(`${BASE}/${evaluationId}/reports/${reportId}`);
}
