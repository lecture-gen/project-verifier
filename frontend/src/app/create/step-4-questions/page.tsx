"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { ApiError } from "@/lib/api/client";
import { useGenerateQuestions } from "@/lib/api/mutations";
import {
  useAdminQuestions,
  useEvaluationStatus,
} from "@/lib/api/queries";
import type { InterviewQuestionRead } from "@/lib/api/endpoints";
import { useWizardGuard } from "@/lib/wizard/guard";
import { useWizardState } from "@/lib/wizard/state";

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function WizardStep4Page() {
  const router = useRouter();
  const guard = useWizardGuard({ step: 4, minStepCompleted: 3 });
  const { markStepCompleted } = useWizardState();

  const evaluationId = guard?.evaluationId ?? "";
  const adminPassword = guard?.adminPassword ?? "";

  const statusQuery = useEvaluationStatus(evaluationId, adminPassword, {
    enabled: Boolean(evaluationId && adminPassword),
    refetchInterval: (query) => {
      const data = query.state.data;
      // 분석이나 질문 생성이 진행 중이면 짧게 폴링.
      if (!data) return 2000;
      if (data.questions_ready) return false;
      return 2000;
    },
  });
  const questionsQuery = useAdminQuestions(evaluationId, adminPassword, {
    enabled: Boolean(evaluationId && adminPassword),
  });
  const generateMutation = useGenerateQuestions(evaluationId, adminPassword);

  if (!guard) return null;

  const status = statusQuery.data;
  const questions = questionsQuery.data ?? [];
  const canGenerate = Boolean(status?.can_generate_questions);
  const hasQuestions = questions.length > 0;

  async function onGenerate() {
    try {
      await generateMutation.mutateAsync();
      toast.success("자료 근거 기반으로 질문을 생성했습니다.");
    } catch (error) {
      toast.error(describeError(error, "질문 생성에 실패했습니다."));
    }
  }

  function onNext() {
    if (!hasQuestions) {
      toast.error("질문이 1개 이상 저장된 후에 다음 단계로 갈 수 있습니다.");
      return;
    }
    markStepCompleted(4);
    router.push("/create/step-5-summary");
  }

  return (
    <WizardShell
      step={4}
      title="질문을 미리 확인합니다."
      description={
        <>
          <p>
            앞서 정의한 정책으로 자료 근거 기반 질문을 생성합니다. 각 질문은 의도와
            검증 초점, 평가 기준, 근거 출처를 함께 갖고 있습니다.
          </p>
          <p className="mt-3 text-sm">
            정책을 다시 바꾸고 싶다면 이전 단계로 돌아가세요. 재생성은 정책 변경 후
            다시 실행됩니다.
          </p>
        </>
      }
      previousLabel="질문 정책"
      nextLabel="학생 공유"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/create/step-3-policy")}
          >
            ← 이전
          </Button>
          <Button type="button" onClick={onNext} disabled={!hasQuestions}>
            다음 단계
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">phase · {status.phase || "-"}</Badge>
                <Badge variant="outline">status · {status.status || "-"}</Badge>
                <Badge variant="outline">
                  질문 {status.question_count} / {status.expected_question_count}
                </Badge>
                {status.has_context ? (
                  <Badge variant="secondary">context 준비</Badge>
                ) : (
                  <Badge variant="outline">context 미준비</Badge>
                )}
              </div>
              {status.user_message && (
                <p className="text-muted-foreground">{status.user_message}</p>
              )}
              {status.blocked_reason && (
                <p className="text-destructive">차단 사유: {status.blocked_reason}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">상태를 불러오는 중…</p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "질문 생성 중…"
                : hasQuestions
                  ? "질문 재생성"
                  : "질문 생성"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                statusQuery.refetch();
                questionsQuery.refetch();
              }}
            >
              상태 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {questions.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            생성된 질문 ({questions.length})
          </h2>
          <ol className="space-y-3">
            {questions.map((question, index) => (
              <li key={question.id}>
                <QuestionCard index={index + 1} question={question} />
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          아직 생성된 질문이 없습니다. context 분석이 끝나면 위에서 질문을 생성하세요.
        </p>
      )}
    </WizardShell>
  );
}

function QuestionCard({
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
          {question.rubric_criteria.slice(0, 3).map((rubric) => (
            <Badge key={rubric} variant="outline">
              {rubric}
            </Badge>
          ))}
        </div>
        <CardTitle className="text-base leading-snug">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {question.intent && (
          <DetailRow label="의도" value={question.intent} />
        )}
        {question.verification_focus && (
          <DetailRow label="검증 초점" value={question.verification_focus} />
        )}
        {question.expected_signal && (
          <DetailRow label="기대 신호" value={question.expected_signal} />
        )}
        {question.expected_evidence && (
          <DetailRow label="필요 근거" value={question.expected_evidence} />
        )}
        {question.source_refs && question.source_refs.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                근거 출처
              </div>
              <ul className="space-y-1">
                {question.source_refs.map((ref, index) => {
                  const lineRange =
                    ref.line_start != null
                      ? `:${ref.line_start}${ref.line_end != null ? `-${ref.line_end}` : ""}`
                      : "";
                  const slide = ref.page_or_slide ? ` · ${ref.page_or_slide}` : "";
                  const role = ref.artifact_role ? `[${ref.artifact_role}] ` : "";
                  return (
                    <li
                      key={`${ref.path}-${index}`}
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
            </div>
          </>
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
