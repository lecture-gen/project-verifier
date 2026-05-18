// 학생 검증 세션 토큰을 httpOnly cookie 로 set/clear 하는 Route Handler.
// 백엔드 라우터는 `interview_session_{session_id}` cookie 또는 X-Session-Token 헤더를 본다.
// 우리는 cookie 만 신뢰하고, 클라이언트는 이 핸들러를 통해서만 토큰을 쓸 수 있다.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  INTERVIEW_SESSION_COOKIE_MAX_AGE,
  interviewSessionCookieName,
} from "@/lib/session/interview";

interface PersistPayload {
  evaluation_id?: unknown;
  evaluationId?: unknown;
  session_id?: unknown;
  sessionId?: unknown;
  session_token?: unknown;
  sessionToken?: unknown;
}

function pickString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: PersistPayload;
  try {
    payload = (await request.json()) as PersistPayload;
  } catch {
    return NextResponse.json({ detail: "잘못된 JSON 본문" }, { status: 400 });
  }

  const evaluationId = pickString(payload.evaluation_id, payload.evaluationId);
  const sessionId = pickString(payload.session_id, payload.sessionId);
  const sessionToken = pickString(payload.session_token, payload.sessionToken);

  if (!evaluationId || !sessionId || !sessionToken) {
    return NextResponse.json(
      {
        detail:
          "evaluation_id, session_id, session_token 가 모두 필요합니다.",
      },
      { status: 400 },
    );
  }

  const store = await cookies();
  store.set(interviewSessionCookieName(sessionId), sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INTERVIEW_SESSION_COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true, session_id: sessionId, evaluation_id: evaluationId });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ detail: "session_id 가 필요합니다." }, { status: 400 });
  }
  const store = await cookies();
  store.delete(interviewSessionCookieName(sessionId));
  return NextResponse.json({ ok: true });
}
