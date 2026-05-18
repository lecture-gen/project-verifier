"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvaluationList } from "@/lib/api/queries";
import type {
  EvaluationStatus,
  ProjectEvaluationSummaryRead,
} from "@/lib/api/endpoints";

const STATUS_LABEL: Record<EvaluationStatus, string> = {
  created: "평가 생성",
  uploaded: "자료 업로드",
  analyzed: "분석 완료",
  questions_generated: "질문 생성",
  interviewing: "검증 중",
  reported: "리포트 완료",
};

export default function AdminListPage() {
  const listQuery = useEvaluationList();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            평가 목록
          </p>
          <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight">
            관리 콘솔
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            카드 클릭 시 해당 평가의 자료·질문·학생별 리포트를 볼 수 있는 콘솔로 이동합니다.
          </p>
        </div>
        <Button asChild>
          <Link href="/create">
            <Plus />새 평가 만들기
          </Link>
        </Button>
      </header>

      {listQuery.isPending && (
        <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          방 목록을 불러오는 중…
        </p>
      )}

      {listQuery.isError && (
        <div className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          방 목록을 불러올 수 없습니다: {listQuery.error.message}
        </div>
      )}

      {listQuery.data && listQuery.data.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          아직 만든 평가가 없습니다. 우상단의 “새 평가 만들기” 로 시작하세요.
        </p>
      )}

      {listQuery.data && listQuery.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listQuery.data.map((evaluation) => (
            <li key={evaluation.id}>
              <EvaluationCard evaluation={evaluation} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EvaluationCard({
  evaluation,
}: {
  evaluation: ProjectEvaluationSummaryRead;
}) {
  const created = new Date(evaluation.created_at);
  const updated = new Date(evaluation.updated_at);
  const statusLabel = STATUS_LABEL[evaluation.status] ?? evaluation.status;

  return (
    <Link
      href={`/admin/${evaluation.id}`}
      className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="cursor-pointer transition-colors hover:border-foreground/30">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{statusLabel}</Badge>
            <Badge variant="outline">질문 {evaluation.question_count}</Badge>
          </div>
          <CardTitle className="text-lg leading-snug">
            {evaluation.name || "(이름 없음)"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>
            생성 {created.toLocaleString("ko-KR")} · 갱신{" "}
            {updated.toLocaleString("ko-KR")}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
