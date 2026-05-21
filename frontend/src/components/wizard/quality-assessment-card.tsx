"use client";

// extract_context 가 끝나면 backend 가 quality assessment 를 자동 실행한다.
// 이 카드는 GET /quality-assessment 폴링으로 결과를 노출하고, 실패 시 운영자가 수동 재시도하도록
// 버튼을 제공한다. silent fallback 금지 — 실패는 그대로 표시.

import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { useRunQualityAssessment } from "@/lib/api/mutations";
import { useEvaluationStatus, useQualityAssessment } from "@/lib/api/queries";
import type { ProjectQualityAssessmentRead } from "@/lib/api/endpoints";

const GRADE_LABEL: Record<
  ProjectQualityAssessmentRead["qualitative_grade"],
  string
> = {
  excellent: "우수",
  good: "양호",
  mediocre: "보통",
  poor: "미흡",
};

const GRADE_VARIANT: Record<
  ProjectQualityAssessmentRead["qualitative_grade"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  excellent: "default",
  good: "secondary",
  mediocre: "outline",
  poor: "destructive",
};

export interface QualityAssessmentCardProps {
  evaluationId: string;
  // 분석이 끝났는지 (context 가 생성됐는지). false 이면 카드 자체를 자리 잡기만 한다.
  contextReady: boolean;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function QualityAssessmentCard({
  evaluationId,
  contextReady,
}: QualityAssessmentCardProps) {
  const statusQuery = useEvaluationStatus(evaluationId, {
    enabled: Boolean(evaluationId) && contextReady,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.has_quality_assessment) return false;
      return 2000;
    },
  });
  const hasQuality = Boolean(statusQuery.data?.has_quality_assessment);
  const qualityQuery = useQualityAssessment(evaluationId, {
    enabled: Boolean(evaluationId) && hasQuality,
    retry: false,
  });
  const retryMutation = useRunQualityAssessment(evaluationId);

  async function onRetry() {
    try {
      await retryMutation.mutateAsync();
      toast.success("프로젝트 품질 평가를 다시 실행했습니다.");
    } catch (error) {
      toast.error(describeError(error, "프로젝트 품질 평가 재실행에 실패했습니다."));
    }
  }

  if (!contextReady) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">4. 프로젝트 품질 평가</CardTitle>
          <p className="text-sm text-muted-foreground">
            프로젝트 분석이 끝나면 자동으로 시작됩니다.
          </p>
        </CardHeader>
      </Card>
    );
  }

  const assessment = qualityQuery.data;

  return (
    <Card
      className={
        assessment
          ? "border-emerald-600/40"
          : retryMutation.isError
            ? "border-destructive/60"
            : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">4. 프로젝트 품질 평가</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            평가 정보(분류·기간·인원·중점사항) 대비 프로젝트가 얼마나 잘 수행됐는지
            정성 등급과 정량 점수로 보여줍니다.
          </p>
        </div>
        {assessment ? (
          <Badge variant="outline" className="gap-1.5 border-emerald-600/40 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> 완료
          </Badge>
        ) : retryMutation.isPending ? (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> 재실행 중
          </Badge>
        ) : statusQuery.isFetching ? (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> 평가 진행 중
          </Badge>
        ) : (
          <Badge variant="outline">대기</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {retryMutation.isError && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            실패 사유: {describeError(retryMutation.error, "(원인 미상)")}
          </div>
        )}
        {assessment ? (
          <QualitySummary assessment={assessment} />
        ) : (
          <p className="text-xs text-muted-foreground">
            결과를 기다리는 중입니다. 자동 재시도는 일어나지 않으며, 실패 시 아래 버튼으로
            다시 실행할 수 있습니다.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Spinner />
            ) : assessment ? (
              "다시 평가"
            ) : (
              "수동 실행"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QualitySummary({
  assessment,
}: {
  assessment: ProjectQualityAssessmentRead;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <Badge variant={GRADE_VARIANT[assessment.qualitative_grade]}>
          {GRADE_LABEL[assessment.qualitative_grade]}
        </Badge>
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            정량 점수
          </div>
          <div className="font-serif text-3xl text-foreground">
            {assessment.quantitative_score.toFixed(1)}{" "}
            <span className="text-base text-muted-foreground">/ 100</span>
          </div>
        </div>
      </div>
      {assessment.workload_baseline && (
        <Section title="작업량 baseline">
          <p className="leading-relaxed">{assessment.workload_baseline}</p>
        </Section>
      )}
      {assessment.summary && (
        <Section title="총평">
          <p className="whitespace-pre-wrap leading-relaxed">{assessment.summary}</p>
        </Section>
      )}
      {assessment.strengths.length > 0 && (
        <Section title="강점">
          <ul className="list-disc space-y-1 pl-5">
            {assessment.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}
      {assessment.concerns.length > 0 && (
        <Section title="우려 지점">
          <ul className="list-disc space-y-1 pl-5">
            {assessment.concerns.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}
      {assessment.rationale && (
        <details className="rounded border border-border/60">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            점수 산정 근거
          </summary>
          <div className="space-y-2 border-t border-border/60 px-3 py-3">
            <p className="whitespace-pre-wrap leading-relaxed">
              {assessment.rationale}
            </p>
            {assessment.evidence_refs.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  근거 출처
                </div>
                <ul className="space-y-0.5">
                  {assessment.evidence_refs.map((ref, index) => (
                    <li key={`${ref}-${index}`} className="font-mono text-xs text-muted-foreground">
                      {ref}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h4>
      {children}
    </section>
  );
}

