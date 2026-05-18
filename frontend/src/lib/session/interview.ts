// 학생 검증 세션의 토큰 보관.
// httpOnly cookie 로만 다루며, 브라우저에서는 직접 읽지 않고 Route Handler 를 통해 set/clear 한다.
// 서버 컴포넌트는 next/headers 의 cookies() 로 직접 토큰을 읽어 백엔드를 호출한다.

export const INTERVIEW_SESSION_COOKIE_MAX_AGE = 60 * 60 * 12; // 12시간

export function interviewSessionCookieName(sessionId: string): string {
  return `interview_session_${sessionId}`;
}

export interface PersistInterviewSessionPayload {
  evaluationId: string;
  sessionId: string;
  sessionToken: string;
}

// 브라우저에서 호출: Next.js Route Handler 에 토큰을 넘겨 httpOnly cookie 로 굳힌다.
export async function persistInterviewSession(
  payload: PersistInterviewSessionPayload,
): Promise<void> {
  const response = await fetch("/api/interview/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `검증 세션 토큰 저장 실패 (${response.status}): ${text || response.statusText}`,
    );
  }
}

export async function clearInterviewSession(sessionId: string): Promise<void> {
  const params = new URLSearchParams({ session_id: sessionId });
  const response = await fetch(`/api/interview/session?${params.toString()}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `검증 세션 토큰 삭제 실패 (${response.status}): ${text || response.statusText}`,
    );
  }
}
