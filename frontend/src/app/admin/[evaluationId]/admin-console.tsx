"use client";

// 관리 콘솔. 평가자 비밀번호 게이트는 제거됨.
// Tabs (개요/자료/문항/리포트). 평가 상세는 업로드 자료와 문항 본문 중심으로 보여준다.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { ReportView } from "@/components/report/report-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminQuestions,
  useArtifacts,
  useEvaluation,
  useEvaluationReports,
  useEvaluationSessions,
  useEvaluationStatus,
  useExtractedContext,
} from "@/lib/api/queries";
import type {
  EvaluationReportRead,
  ExtractedProjectContextRead,
  InterviewQuestionRead,
  InterviewSessionRead,
  ProjectArtifactRead,
} from "@/lib/api/endpoints";
import { AreasGrid } from "@/components/wizard/context/AreasGrid";
import { ArchitectureCanvas } from "@/components/wizard/context/ArchitectureCanvas";
import { DependencyList } from "@/components/wizard/context/DependencyList";
import { FileTreeView } from "@/components/wizard/context/FileTreeView";
import { ReadmeOutlineList } from "@/components/wizard/context/ReadmeOutlineList";
import { StructuralFactsPanel } from "@/components/wizard/context/StructuralFactsPanel";
import { StudentRisksCards } from "@/components/wizard/context/StudentRisksCards";
import { TechStackTable } from "@/components/wizard/context/TechStackTable";

const TABS = ["overview", "artifacts", "questions", "report"] as const;
type AdminTab = (typeof TABS)[number];

const TAB_LABEL: Record<AdminTab, string> = {
  overview: "개요",
  artifacts: "자료",
  questions: "문항",
  report: "리포트",
};

function normalizeTab(value: string | null): AdminTab {
  if (!value) return "overview";
  if ((TABS as readonly string[]).includes(value)) return value as AdminTab;
  // 이전 'status' 키도 overview 로 매핑.
  if (value === "status") return "overview";
  return "overview";
}

interface AdminConsoleProps {
  evaluationId: string;
}

export function AdminConsole({ evaluationId }: AdminConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams.get("tab"));

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/admin/${evaluationId}?${params.toString()}`);
  }

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
        </div>
        <Button asChild variant="outline">
          <Link
            href={`/interview/${evaluationId}/join`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink />학생 입장 페이지 열기
          </Link>
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {TAB_LABEL[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <OverviewTab evaluationId={evaluationId} />
        </TabsContent>
        <TabsContent value="artifacts" className="pt-6">
          <ArtifactsTab evaluationId={evaluationId} />
        </TabsContent>
        <TabsContent value="questions" className="pt-6">
          <QuestionsTab evaluationId={evaluationId} />
        </TabsContent>
        <TabsContent value="report" className="pt-6">
          <ReportTab evaluationId={evaluationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- 개요 탭 ----------

function OverviewTab({ evaluationId }: { evaluationId: string }) {
  const evaluationQuery = useEvaluation(evaluationId);
  const statusQuery = useEvaluationStatus(evaluationId, {
    refetchInterval: 3000,
  });
  const artifactsQuery = useArtifacts(evaluationId);
  const contextQuery = useExtractedContext(evaluationId, { retry: false });

  const evaluation = evaluationQuery.data;
  const status = statusQuery.data;
  const artifacts = artifactsQuery.data ?? [];
  const context = contextQuery.data;

  // #5 정책: 차단 사유는 문항 단계까지 도달한 상황(문항이 1개 이상 저장됐거나
  // 문항 생성이 한 번이라도 시도된 상태)에서만 노출한다. 관리 콘솔 초기 진입에는
  // 보여주지 않는다.
  const showBlockedReason = Boolean(
    status?.blocked_reason &&
      (status.question_count > 0 ||
        status.phase === "questions_ready" ||
        status.phase === "question_count_mismatch"),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">평가 메타</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {evaluation ? (
            <>
              <MetaRow label="평가 명" value={evaluation.name} />
              <MetaRow
                label="문항 정책"
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
                  문항 {status.question_count}/{status.expected_question_count}
                </Badge>
                {status.has_artifacts && (
                  <Badge variant="outline">자료 업로드됨</Badge>
                )}
                {status.has_context && <Badge variant="outline">분석 완료</Badge>}
                {status.questions_ready && (
                  <Badge variant="outline">문항 준비</Badge>
                )}
                {status.can_join && <Badge variant="outline">학생 입장 가능</Badge>}
              </div>
              {status.user_message && (
                <p className="text-muted-foreground">{status.user_message}</p>
              )}
              {showBlockedReason && (
                <p className="text-destructive">
                  차단 사유: {status.blocked_reason}
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">상태를 불러오는 중…</p>
          )}
        </CardContent>
      </Card>

      <ProjectInfoCard
        artifacts={artifacts}
        context={context}
        loading={contextQuery.isPending && artifactsQuery.isPending}
      />
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

// ---------- 자료 / 분석 요약 ----------

function ArtifactsTab({ evaluationId }: { evaluationId: string }) {
  const artifactsQuery = useArtifacts(evaluationId);
  const contextQuery = useExtractedContext(evaluationId, { retry: false });

  const artifacts = artifactsQuery.data ?? [];
  const context = contextQuery.data;

  return (
    <div className="space-y-6">
      <ProjectInfoCard
        artifacts={artifacts}
        context={context}
        loading={contextQuery.isPending}
      />

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

function ProjectInfoCard({
  artifacts,
  context,
  loading,
}: {
  artifacts: ProjectArtifactRead[];
  context: ExtractedProjectContextRead | undefined;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">프로젝트 분석 요약</CardTitle>
        <p className="text-sm text-muted-foreground">
          업로드된 자료 {artifacts.length}건을 기반으로 한 분석 결과입니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {context ? (
          <>
            {context.summary && (
              <AdminSection title="프로젝트 요약">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {context.summary}
                </p>
              </AdminSection>
            )}
            <AdminSection title="기술 스택">
              <TechStackTable items={context.tech_stack ?? []} />
            </AdminSection>
            <AdminSection title="아키텍처">
              <ArchitectureCanvas architecture={context.architecture} />
            </AdminSection>
            <AdminSection title="주요 기능">
              <AdminFeaturesList items={context.features ?? []} />
            </AdminSection>
            <AdminSection title="영역">
              <AreasGrid areas={context.areas ?? []} />
            </AdminSection>
            <AdminSection title="학생이 부딪혔을 만한 구현 난점">
              <StudentRisksCards
                risks={context.student_implementation_risks ?? []}
              />
            </AdminSection>
            <AdminSection title="구조 통계">
              <StructuralFactsPanel facts={context.structural_facts} />
            </AdminSection>
            <details className="rounded border border-border/60">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                파일 트리 · 의존성 · README 헤더 보기
              </summary>
              <div className="space-y-5 border-t border-border/60 px-3 py-3">
                <AdminSection title="파일 트리" small>
                  <FileTreeView tree={context.structural_facts?.file_tree ?? []} />
                </AdminSection>
                <AdminSection title="의존성 목록" small>
                  <DependencyList
                    items={context.structural_facts?.dependencies ?? []}
                  />
                </AdminSection>
                <AdminSection title="README 헤더" small>
                  <ReadmeOutlineList
                    entries={context.structural_facts?.readme_outline ?? []}
                  />
                </AdminSection>
              </div>
            </details>
          </>
        ) : loading ? (
          <p className="text-muted-foreground">불러오는 중…</p>
        ) : (
          <p className="text-muted-foreground">
            아직 분석이 실행되지 않았습니다. 마법사에서 자료를 업로드하세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminSection({
  title,
  children,
  small = false,
}: {
  title: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <section>
      <h3
        className={`mb-2 uppercase tracking-[0.18em] text-muted-foreground ${
          small ? "text-[10px]" : "text-xs"
        }`}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function AdminFeaturesList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        식별된 사용자 시각의 제품 기능이 없습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-sm">
          <span className="text-muted-foreground">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
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

// ---------- 문항 탭 ----------

function QuestionsTab({ evaluationId }: { evaluationId: string }) {
  const questionsQuery = useAdminQuestions(evaluationId);
  const questions = questionsQuery.data ?? [];

  if (questionsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">문항을 불러오는 중…</p>;
  }
  if (questions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        아직 생성된 문항이 없습니다. 마법사 4단계에서 생성하세요.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/60 px-3 py-2 text-xs text-muted-foreground">
        최종 리포트에서 점수는 100점으로 정규화됩니다.
      </div>
      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li key={question.id}>
            <AdminQuestionCard index={index + 1} question={question} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function AdminQuestionCard({
  index,
  question,
}: {
  index: number;
  question: InterviewQuestionRead;
}) {
  const rubric = question.scoring_rubric ?? [];
  const rubricTotal = rubric.reduce((sum, item) => sum + (item.points ?? 0), 0);
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">Q{index}</span>
          <Badge variant="secondary">{question.bloom_level}</Badge>
          <Badge variant="default">{question.max_points}점 만점</Badge>
        </div>
        <CardTitle className="text-base leading-snug">
          {question.question}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {question.intent && (
          <DetailRow label="출제 의도" value={question.intent} />
        )}
        {question.expected_answer && (
          <DetailRow label="기대 답안" value={question.expected_answer} />
        )}
        {rubric.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>채점 기준표</span>
              <span className="font-mono normal-case tracking-normal">
                합계 {rubricTotal}점
              </span>
            </div>
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {rubric.map((item, itemIndex) => (
                <li
                  key={`${item.description}-${itemIndex}`}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <span className="leading-relaxed text-foreground">
                    {item.description}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {item.points}점
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {question.source_refs && question.source_refs.length > 0 && (
          <details className="group rounded-md border border-border/60 px-3 py-2">
            <summary className="cursor-pointer select-none text-xs uppercase tracking-[0.16em] text-muted-foreground">
              근거 출처 ({question.source_refs.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {question.source_refs.map((ref, refIndex) => {
                const lineRange =
                  ref.line_start != null
                    ? `:${ref.line_start}${ref.line_end != null ? `-${ref.line_end}` : ""}`
                    : "";
                const slide = ref.page_or_slide ? ` · ${ref.page_or_slide}` : "";
                const role = ref.artifact_role ? `[${ref.artifact_role}] ` : "";
                return (
                  <li
                    key={`${ref.path}-${refIndex}`}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {role}
                    {ref.path}
                    {lineRange}
                    {slide}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <p className="leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

// ---------- 리포트 탭 ----------

// 한 평가에 여러 학생이 입장할 수 있으므로, 세션(학생)별 리포트를 셀렉터로 전환해 보여준다.
// 세션 목록은 InterviewSessionRow 기반 (참여한 학생 1명당 1개 세션).
// 리포트 목록은 EvaluationReportRow 기반 (세션 완료 시 1건씩 생성). 한 세션에 여러 리포트가
// 쌓일 수 있으므로(예: 재완료) session_id 별 가장 최신 1건만 사용한다.
function ReportTab({ evaluationId }: { evaluationId: string }) {
  const sessionsQuery = useEvaluationSessions(evaluationId, { retry: false });
  const reportsQuery = useEvaluationReports(evaluationId, { retry: false });

  const sessions = sessionsQuery.data ?? [];
  const reports = reportsQuery.data ?? [];

  // session_id → 최신 EvaluationReportRead.
  const reportBySession = useMemo(() => {
    const map = new Map<string, EvaluationReportRead>();
    for (const report of reports) {
      const existing = map.get(report.session_id);
      if (!existing || new Date(report.created_at) > new Date(existing.created_at)) {
        map.set(report.session_id, report);
      }
    }
    return map;
  }, [reports]);

  // 리포트가 존재하는 세션만 노출. 최근 완료 순.
  const completedSessions = useMemo(() => {
    return sessions
      .filter((session) => reportBySession.has(session.id))
      .sort((a, b) => {
        const aReport = reportBySession.get(a.id)!;
        const bReport = reportBySession.get(b.id)!;
        return (
          new Date(bReport.created_at).getTime() -
          new Date(aReport.created_at).getTime()
        );
      });
  }, [sessions, reportBySession]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // 세션 목록이 갱신되면, 선택값이 비었거나 사라진 경우 가장 최신 세션을 자동 선택한다.
  useEffect(() => {
    if (completedSessions.length === 0) {
      if (selectedSessionId !== null) setSelectedSessionId(null);
      return;
    }
    const stillValid = completedSessions.some(
      (session) => session.id === selectedSessionId,
    );
    if (!stillValid) {
      setSelectedSessionId(completedSessions[0]!.id);
    }
  }, [completedSessions, selectedSessionId]);

  if (sessionsQuery.isPending || reportsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">리포트를 불러오는 중…</p>;
  }

  if (completedSessions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
        아직 생성된 리포트가 없습니다. 학생가 검증를 완료하면 학생별로 리포트가 채워집니다.
      </p>
    );
  }

  const selectedReport = selectedSessionId
    ? reportBySession.get(selectedSessionId) ?? null
    : null;
  const selectedSession = selectedSessionId
    ? completedSessions.find((session) => session.id === selectedSessionId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">학생별 리포트</CardTitle>
          <p className="text-xs text-muted-foreground">
            이 평가에 검증를 완료한 학생 {completedSessions.length}명. 카드를 눌러 학생별
            리포트를 전환할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {completedSessions.map((session) => (
              <li key={session.id}>
                <ParticipantSelectorButton
                  session={session}
                  report={reportBySession.get(session.id)!}
                  selected={session.id === selectedSessionId}
                  onSelect={() => setSelectedSessionId(session.id)}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {selectedReport && selectedSession && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedSession.participant_name || "(이름 미입력)"} 의 리포트
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                완료 {new Date(selectedReport.created_at).toLocaleString("ko-KR")}
              </p>
            </CardHeader>
          </Card>
          <ReportView report={selectedReport} audience="admin" />
        </>
      )}
    </div>
  );
}

function ParticipantSelectorButton({
  session,
  report,
  selected,
  onSelect,
}: {
  session: InterviewSessionRead;
  report: EvaluationReportRead;
  selected: boolean;
  onSelect: () => void;
}) {
  const completedAt = new Date(report.created_at).toLocaleString("ko-KR");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded border px-3 py-2 text-left transition-colors ${
        selected
          ? "border-foreground/60 bg-foreground/5"
          : "border-border/60 hover:border-foreground/30"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">
          {session.participant_name || "(이름 미입력)"}
        </span>
        <Badge variant="outline" className="text-[10px]">
          {report.final_decision}
        </Badge>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">완료 {completedAt}</p>
    </button>
  );
}
