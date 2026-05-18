// 학생용 /interview/[id]/report 와 평가자용 /admin/[id]?tab=report 가 공유하는
// 단일 리포트 뷰. EvaluationReportRead 만 받아 자체적으로 narrow 한 데이터를 만든다.

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { EvaluationReportRead } from "@/lib/api/endpoints";

import { BloomRadar } from "./bloom-radar";
import {
  parseAreaAnalyses,
  parseBloomSummary,
  parseQuestionEvaluations,
} from "./schema";
import { VerdictBadge } from "./verdict-badge";

export interface ReportViewProps {
  report: EvaluationReportRead;
  // 평가자 콘솔에서 노출할지(true), 학생 페이지에서 노출할지(false). 일부 섹션 가시성 분기에 사용.
  audience?: "admin" | "participant";
}

export function ReportView({ report, audience = "participant" }: ReportViewProps) {
  const bloomRows = parseBloomSummary(report.bloom_summary);
  const areaRows = parseAreaAnalyses(report.area_analyses);
  const questionRows = parseQuestionEvaluations(report.question_evaluations);
  const totalScore = report.total_score ?? report.authenticity_score ?? 0;
  const totalMaxScore = report.total_max_score ?? 100;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <VerdictBadge
              decision={report.final_decision}
              score={(report.authenticity_score ?? 0) / 100}
            />
            <Badge variant="outline">
              {new Date(report.created_at).toLocaleString("ko-KR")}
            </Badge>
          </div>
          <CardTitle className="font-serif text-2xl leading-tight">
            최종 판정
          </CardTitle>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-foreground">
              {totalScore.toFixed(1)}
            </span>
            <span className="font-mono text-lg text-muted-foreground">
              / {totalMaxScore.toFixed(0)}점
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {report.summary && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {report.summary}
            </p>
          )}
        </CardContent>
      </Card>

      {bloomRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bloom 단계 도달도</CardTitle>
            <p className="text-xs text-muted-foreground">
              질문 인지 단계별 평균 점수율(0~100%).
            </p>
          </CardHeader>
          <CardContent>
            <BloomRadar rows={bloomRows} />
          </CardContent>
        </Card>
      )}

      {areaRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">프로젝트 영역별 평가</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {areaRows.map((row, index) => (
              <div
                key={`${row.area_name}-${index}`}
                className="rounded border border-border/60 px-3 py-2"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{row.area_name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{row.decision}</Badge>
                    <span className="font-mono text-muted-foreground">
                      {row.score.toFixed(1)}점
                    </span>
                  </div>
                </div>
                {row.summary && (
                  <p className="text-muted-foreground">{row.summary}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportPanel title="강점" items={report.strengths ?? []} />
        <ReportPanel
          title="자료-답변 정합성"
          items={report.evidence_alignment ?? []}
        />
        {audience === "admin" && (
          <ReportPanel
            title="의심 지점"
            items={report.suspicious_points ?? []}
            tone="danger"
          />
        )}
        <ReportPanel
          title="추가 확인 권장 질문"
          items={report.recommended_followups ?? []}
        />
      </div>

      {questionRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">문제별 채점 결과</CardTitle>
            <p className="text-xs text-muted-foreground">
              각 문제의 채점 기준표 단위로 부여된 점수와 근거를 확인할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {questionRows.map((row) => (
              <div
                key={`${row.order_index}-${row.question}`}
                className="rounded border border-border/60 px-3 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    Q{row.order_index + 1}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{row.bloom_level}</Badge>
                    <span className="font-mono text-foreground">
                      <span className="text-base font-bold">
                        {row.score.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        / {row.max_score.toFixed(0)}점
                      </span>
                    </span>
                  </div>
                </div>
                <p className="font-medium leading-snug">{row.question}</p>
                {row.summary && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-muted-foreground">{row.summary}</p>
                  </>
                )}
                {row.rubric_breakdown.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      채점 기준별 결과
                    </div>
                    <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                      {row.rubric_breakdown.map((item, itemIndex) => {
                        const fullyAwarded =
                          item.max_points > 0 &&
                          item.awarded >= item.max_points;
                        const partiallyAwarded =
                          item.awarded > 0 && !fullyAwarded;
                        return (
                          <li
                            key={`${item.description}-${itemIndex}`}
                            className="px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <span className="leading-relaxed text-foreground">
                                {item.description}
                              </span>
                              <span
                                className={`shrink-0 font-mono text-xs ${
                                  fullyAwarded
                                    ? "text-foreground"
                                    : partiallyAwarded
                                      ? "text-muted-foreground"
                                      : "text-destructive"
                                }`}
                              >
                                {item.awarded} / {item.max_points}점
                              </span>
                            </div>
                            {item.rationale && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.rationale}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportPanel({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "danger";
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span
                className={
                  tone === "danger" ? "text-destructive" : "text-muted-foreground"
                }
              >
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
