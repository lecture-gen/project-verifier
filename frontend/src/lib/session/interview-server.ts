// 서버 컴포넌트 / Route Handler 전용 helper.
// 클라이언트 컴포넌트에서 이 파일을 import 하면 빌드 에러가 나도록 next/headers 에 직접 의존한다.

import { cookies } from "next/headers";

import { interviewSessionCookieName } from "./interview";

export async function readInterviewSessionToken(sessionId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(interviewSessionCookieName(sessionId))?.value ?? null;
}
