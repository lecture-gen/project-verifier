// 지원자용 리포트 페이지. URL ?sessionId=... 으로 진입한다.
// httpOnly cookie 의 session token 으로 백엔드를 호출. completeSession 은 idempotent 라서
// 이미 종료된 세션은 기존 리포트를 그대로 반환한다.

import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportView } from "@/components/report/report-view";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { completeSession } from "@/lib/api/endpoints";
import { readInterviewSessionToken } from "@/lib/session/interview-server";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
  searchParams: Promise<{ sessionId?: string | string[] }>;
}

function pickSingle(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function InterviewReportPage({
  params,
  searchParams,
}: PageProps) {
  const { evaluationId } = await params;
  const { sessionId: rawSessionId } = await searchParams;
  const sessionId = pickSingle(rawSessionId);

  if (!sessionId) {
    return (
      <FallbackMessage evaluationId={evaluationId}>
        세션 정보가 누락되어 리포트를 열 수 없습니다. 인터뷰를 다시 시작해 주세요.
      </FallbackMessage>
    );
  }

  const sessionToken = await readInterviewSessionToken(sessionId);
  if (!sessionToken) {
    redirect(`/interview/${evaluationId}/join`);
  }

  const report = await completeSession(evaluationId, sessionId, sessionToken, {
    internal: true,
  }).catch((error: unknown) => {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      redirect(`/interview/${evaluationId}/join`);
    }
    throw error;
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          인터뷰 리포트
        </p>
        <h1 className="font-serif text-3xl leading-tight">결과 요약</h1>
        <p className="text-sm text-muted-foreground">
          이 리포트는 인터뷰 종료 시점의 데이터를 기반으로 생성됩니다. 필요하면
          관리자에게 추가 확인 질문을 요청하세요.
        </p>
      </header>
      <ReportView report={report} audience="participant" />
    </div>
  );
}

function FallbackMessage({
  evaluationId,
  children,
}: {
  evaluationId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
      <Button asChild variant="outline">
        <Link href={`/interview/${evaluationId}/join`}>인터뷰 다시 시작</Link>
      </Button>
    </div>
  );
}
