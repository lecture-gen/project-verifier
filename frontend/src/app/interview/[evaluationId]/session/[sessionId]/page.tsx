// 학생 검증 진행 페이지의 server entry.
// httpOnly cookie 에서 session token 을 읽어 백엔드 상태를 SSR fetch 한 뒤, 클라이언트 runner 에
// 토큰과 초기 state 를 props 로 넘긴다.

import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getInterviewState,
  listQuestionsAsParticipant,
} from "@/lib/api/endpoints";
import { readInterviewSessionToken } from "@/lib/session/interview-server";

import { InterviewRunner } from "./interview-runner";

interface PageProps {
  params: Promise<{ evaluationId: string; sessionId: string }>;
}

export default async function InterviewSessionPage({ params }: PageProps) {
  const { evaluationId, sessionId } = await params;
  const sessionToken = await readInterviewSessionToken(sessionId);

  if (!sessionToken) {
    redirect(`/interview/${evaluationId}/join`);
  }

  const [initialState, initialQuestions] = await Promise.all([
    getInterviewState(evaluationId, sessionId, sessionToken, { internal: true }),
    listQuestionsAsParticipant(evaluationId, sessionId, sessionToken),
  ]).catch((error: unknown) => {
    // 토큰이 만료/위조됐거나 백엔드가 인증을 거부하면 join 으로 돌려보낸다.
    // 그 외 오류는 Next.js 의 가까운 error boundary 로 흘려보낸다.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      redirect(`/interview/${evaluationId}/join`);
    }
    throw error;
  });

  return (
    <InterviewRunner
      evaluationId={evaluationId}
      sessionId={sessionId}
      sessionToken={sessionToken}
      initialState={initialState}
      initialQuestions={initialQuestions}
    />
  );
}
