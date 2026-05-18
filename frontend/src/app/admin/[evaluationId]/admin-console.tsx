"use client";

// 관리 콘솔. admin password 게이트 + Tabs (상태/자료/질문/리포트).
// 리포트 탭은 Phase 9 에서 본격 시각화로 교체할 placeholder 상태.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AdminPasswordDialog } from "@/components/admin/admin-password-dialog";
import { ReportView } from "@/components/report/report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminPassword } from "@/lib/session/admin";
import {
  useAdminQuestions,
  useArtifacts,
  useEvaluation,
  useEvaluationStatus,
  useExtractedContext,
  useLatestReport,
} from "@/lib/api/queries";
import type {
  InterviewQuestionRead,
  ProjectArtifactRead,
} from "@/lib/api/endpoints";

const TABS = ["status", "artifacts", "questions", "report"] as const;
type AdminTab = (typeof TABS)[number];

const TAB_LABEL: Record<AdminTab, string> = {
  status: "상태",
  artifacts: "자료",
  questions: "질문",
  report: "리포트",
};

function normalizeTab(value: string | null): AdminTab {
  if (!value) return "status";
  return (TABS as readonly string[]).includes(value)
    ? (value as AdminTab)
    : "status";
}

interface AdminConsoleProps {
  evaluationId: string;
}

export function AdminConsole({ evaluationId }: AdminConsoleProps) {
  const { password, hydrated } = useAdminPassword(evaluationId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/admin/${evaluationId}?${params.toString()}`);
  }

  // hydrate 이전에 dialog 자동 열기 방지.
  const showDialog = hydrated && !password;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/admin">
              <ArrowLeft />방 목록
            </Link>
          </Button>
          <h1 className="mt-2 font-serif text-3xl leading-tight">관리 콘솔</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            평가 ID · {evaluationId}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link
            href={`/interview/${evaluationId}/join`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink />지원자 입장 페이지 열기
          </Link>
        </Button>
      </header>

      {password ? (
        <Tabs value={activeTab} onValueChange={setTab}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABEL[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="status" className="pt-6">
            <StatusTab evaluationId={evaluationId} adminPassword={password} />
          </TabsContent>
          <TabsContent value="artifacts" className="pt-6">
            <ArtifactsTab evaluationId={evaluationId} adminPassword={password} />
          </TabsContent>
          <TabsContent value="questions" className="pt-6">
            <QuestionsTab evaluationId={evaluationId} adminPassword={password} />
          </TabsContent>
          <TabsContent value="report" className="pt-6">
            <ReportTab evaluationId={evaluationId} adminPassword={password} />
          </TabsContent>
        </Tabs>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          평가자 비밀번호를 입력해야 콘솔을 볼 수 있습니다.
        </p>
      )}

      <AdminPasswordDialog
        evaluationId={evaluationId}
        open={showDialog}
        onOpenChange={(next) => {
          if (!next && !password) router.push("/admin");
        }}
        onVerified={() => {
          // useAdminPassword 가 sessionStorage 변경을 감지해 password 가 채워진다.
        }}
      />
    </div>
  );
}

// ---------- 상태 탭 ----------

function StatusTab({
  evaluationId,
  adminPassword,
}: {
  evaluationId: string;
  adminPassword: string;
}) {
  const evaluationQuery = useEvaluation(evaluationId, adminPassword);
  const statusQuery = useEvaluationStatus(evaluationId, adminPassword, {
    refetchInterval: 3000,
  });
  const evaluation = evaluationQuery.data;
  const status = statusQuery.data;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">평가 메타</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {evaluation ? (
            <>
              <MetaRow label="방 이름" value={evaluation.room_name} />
              <MetaRow label="프로젝트" value={evaluation.project_name} />
              <MetaRow label="지원자" value={evaluation.candidate_name} />
              <MetaRow
                label="질문 정책"
                value={`총 ${evaluation.question_policy.total_question_count} 문항`}
              />
              <MetaRow
                label="생성 / 갱신"
                value={`${new Date(evaluation.created_at).toLocaleString("ko-KR")} · ${new Date(evaluation.updated_at).toLocaleString("ko-KR")}`}
              />
            </>
          ) : (
            <p className="text-muted-foreground">평가 정보를 불러오는 중…</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">진행 상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status ? (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{status.status}</Badge>
                <Badge variant="outline">phase · {status.phase || "-"}</Badge>
                <Badge variant="outline">
                  질문 {status.question_count}/{status.expected_question_count}
                </Badge>
                {status.has_artifacts && (
                  <Badge variant="outline">자료 업로드됨</Badge>
                )}
                {status.has_context && (
                  <Badge variant="outline">분석 완료</Badge>
                )}
                {status.questions_ready && (
                  <Badge variant="outline">질문 준비</Badge>
                )}
                {status.can_join && <Badge variant="outline">학생 입장 가능</Badge>}
              </div>
              {status.user_message && (
                <p className="text-muted-foreground">{status.user_message}</p>
              )}
              {status.blocked_reason && (
                <p className="text-destructive">
                  차단 사유: {status.blocked_reason}
                </p>
              )}
              {status.check_targets && status.check_targets.length > 0 && (
                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    확인 필요
                  </div>
                  <ul className="space-y-1">
                    {status.check_targets.map((item, index) => (
                      <li key={index}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">상태를 불러오는 중…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right">{value || "-"}</span>
    </div>
  );
}

// ---------- 자료 탭 ----------

function ArtifactsTab({
  evaluationId,
  adminPassword,
}: {
  evaluationId: string;
  adminPassword: string;
}) {
  const artifactsQuery = useArtifacts(evaluationId, adminPassword);
  const contextQuery = useExtractedContext(evaluationId, adminPassword, {
    retry: false,
  });

  const artifacts = artifactsQuery.data ?? [];
  const context = contextQuery.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">분석 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {context ? (
            <p className="whitespace-pre-wrap leading-relaxed">
              {context.summary || "요약이 비어 있습니다."}
            </p>
          ) : contextQuery.isPending ? (
            <p className="text-muted-foreground">불러오는 중…</p>
          ) : (
            <p className="text-muted-foreground">
              아직 분석이 실행되지 않았습니다. 마법사 2단계에서 자료를 업로드하세요.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">artifacts ({artifacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              업로드된 자료가 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 text-sm">
              {artifacts.map((artifact) => (
                <li key={artifact.id} className="py-2">
                  <ArtifactRow artifact={artifact} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: ProjectArtifactRead }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-muted-foreground">
          {artifact.source_path || artifact.id}
        </p>
        <p className="text-xs text-muted-foreground">
          {artifact.char_count.toLocaleString("ko-KR")}자
          {artifact.text_preview ? ` · ${artifact.text_preview.slice(0, 60)}…` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline">{artifact.source_type}</Badge>
        <Badge
          variant={artifact.status === "failed" ? "destructive" : "secondary"}
        >
          {artifact.status}
        </Badge>
      </div>
    </div>
  );
}

// ---------- 질문 탭 ----------

function QuestionsTab({
  evaluationId,
  adminPassword,
}: {
  evaluationId: string;
  adminPassword: string;
}) {
  const questionsQuery = useAdminQuestions(evaluationId, adminPassword);
  const questions = questionsQuery.data ?? [];

  if (questionsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">질문을 불러오는 중…</p>;
  }
  if (questions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        아직 생성된 질문이 없습니다. 마법사 4단계에서 생성하세요.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {questions.map((question, index) => (
        <li key={question.id}>
          <AdminQuestionCard index={index + 1} question={question} />
        </li>
      ))}
    </ol>
  );
}

function AdminQuestionCard({
  index,
  question,
}: {
  index: number;
  question: InterviewQuestionRead;
}) {
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">Q{index}</span>
          <Badge variant="secondary">{question.bloom_level}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
        <CardTitle className="text-base leading-snug">
          {question.question}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {question.intent && (
          <p>
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              의도
            </span>
            <br />
            {question.intent}
          </p>
        )}
        {question.verification_focus && (
          <p className="text-muted-foreground">
            검증 초점 · {question.verification_focus}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- 리포트 탭 (Phase 9 에서 본격 시각화) ----------

function ReportTab({
  evaluationId,
  adminPassword,
}: {
  evaluationId: string;
  adminPassword: string;
}) {
  const reportQuery = useLatestReport(evaluationId, adminPassword, {
    retry: false,
  });
  const report = reportQuery.data;

  if (reportQuery.isPending) {
    return <p className="text-sm text-muted-foreground">리포트를 불러오는 중…</p>;
  }
  if (!report) {
    return (
      <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        아직 생성된 리포트가 없습니다. 인터뷰가 끝나면 자동으로 채워집니다.
      </p>
    );
  }

  return <ReportView report={report} audience="admin" />;
}

