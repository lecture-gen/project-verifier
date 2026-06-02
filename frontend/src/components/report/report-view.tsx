// 학생용 /interview/[id]/report 와 평가자용 /admin/[id]?tab=report 가 공유하는
// 단일 리포트 뷰. EvaluationReportRead 만 받아 자체적으로 narrow 한 데이터를 만든다.

"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { EvaluationReportRead } from "@/lib/api/endpoints";
import { formatKstDateTime } from "@/lib/format/datetime";

import { BloomRadar } from "./bloom-radar";
import {
  parseBloomSummary,
  parseQuestionEvaluations,
  summarizeQuestionScores,
  type QuestionEvaluationRow,
} from "./schema";
import { VerdictBadge } from "./verdict-badge";

export interface ReportViewProps {
  report: EvaluationReportRead;
  // 평가자 콘솔에서 노출할지(true), 학생 페이지에서 노출할지(false). 일부 섹션 가시성 분기에 사용.
  audience?: "admin" | "participant";
}

export function ReportView({ report }: ReportViewProps) {
  const bloomRows = parseBloomSummary(report.bloom_summary);
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
              {formatKstDateTime(report.created_at)}
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

      {questionRows.length > 0 && (
        <ScoreBreakdown
          rows={questionRows}
          totalScore={totalScore}
          totalMaxScore={totalMaxScore}
        />
      )}

      {questionRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">문제별 채점 결과</CardTitle>
            <p className="text-xs text-muted-foreground">
              각 문제의 채점 기준표 단위로 부여된 점수와 근거를 확인할 수 있습니다.
              {" "}
              <span className="text-muted-foreground/80">
                “상세 보기”를 누르면 학생 답변과 꼬리질문을 펼쳐 볼 수
                있습니다.
              </span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {questionRows.map((row) => (
              <QuestionEvaluationCard
                key={`${row.order_index}-${row.question}`}
                row={row}
              />
            ))}
          </CardContent>
        </Card>
      )}

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

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportPanel title="강점" items={report.strengths ?? []} />
        <ReportPanel
          title="약점"
          items={report.weaknesses ?? []}
          tone="danger"
        />
      </div>
    </div>
  );
}

function ScoreBreakdown({
  rows,
  totalScore,
  totalMaxScore,
}: {
  rows: QuestionEvaluationRow[];
  totalScore: number;
  totalMaxScore: number;
}) {
  const { rawTotal, rawMax, computedNormalized } = summarizeQuestionScores(rows);
  // 합산 환산값과 백엔드 최종 점수가 (라운딩 오차 범위에서) 일치할 때만 환산식을 단정한다.
  const matchesFinal = Math.abs(computedNormalized - totalScore) < 0.5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">점수 산출 근거</CardTitle>
        <p className="text-xs text-muted-foreground">
          각 문제에서 받은 점수를 모두 더한 뒤 100점 만점으로 환산해 최종 점수가
          정해집니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-muted-foreground">문제별 획득 점수 합계</span>
            <span className="font-mono text-foreground">
              <span className="text-lg font-bold">{rawTotal.toFixed(1)}</span>
              <span className="text-muted-foreground">
                {" "}
                / {rawMax.toFixed(0)}점
              </span>
            </span>
          </div>
          {matchesFinal ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              <span className="font-mono">
                {rawTotal.toFixed(1)} ÷ {rawMax.toFixed(0)} × 100
              </span>
              <span aria-hidden>→</span>
              <span className="font-mono text-foreground">
                최종 {totalScore.toFixed(1)} / {totalMaxScore.toFixed(0)}점
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              최종 점수는 {totalScore.toFixed(1)} / {totalMaxScore.toFixed(0)}점
              입니다.
            </p>
          )}
        </div>

        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            문제별 기여
          </div>
          <ul className="divide-y divide-border/60 rounded-md border border-border/60">
            {rows.map((row) => {
              const contribution =
                rawMax > 0 ? (row.score / rawMax) * 100 : 0;
              return (
                <li
                  key={`${row.order_index}-${row.question}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      Q{row.order_index + 1}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {row.bloom_level}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3 text-xs">
                    <span className="font-mono text-foreground">
                      {row.score.toFixed(1)} / {row.max_score.toFixed(0)}점
                    </span>
                    <span className="font-mono text-muted-foreground">
                      +{contribution.toFixed(1)}점
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">
            “기여”는 각 문제가 100점 만점 최종 점수에 더한 점수입니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionEvaluationCard({ row }: { row: QuestionEvaluationRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    row.student_answer.trim().length > 0 || row.follow_up_exchanges.length > 0;

  return (
    <div className="rounded border border-border/60 px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          Q{row.order_index + 1}
        </span>
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary">{row.bloom_level}</Badge>
          <span className="font-mono text-foreground">
            <span className="text-base font-bold">{row.score.toFixed(1)}</span>
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
                item.max_points > 0 && item.awarded >= item.max_points;
              const partiallyAwarded = item.awarded > 0 && !fullyAwarded;
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
      {hasDetails && (
        <div className="mt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {expanded ? "상세 접기 ▴" : "학생 답변·꼬리질문 보기 ▾"}
          </Button>
          {expanded && (
            <div className="mt-2 space-y-3 rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
              {row.student_answer.trim().length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    학생 답변
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {row.student_answer}
                  </p>
                </div>
              )}
              {row.follow_up_exchanges.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    꼬리질문
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    답변 내용을 더 깊이 확인하기 위해 추가로 던진 질문입니다. 각
                    질문이 나온 이유와, 학생의 답변으로 보충된 부분이 있는지
                    보여줍니다.
                  </p>
                  <ul className="space-y-2">
                    {row.follow_up_exchanges.map((exchange) => {
                      const answered = exchange.answer.trim().length > 0;
                      return (
                        <li
                          key={exchange.round}
                          className="rounded border border-border/40 bg-background/60 p-2"
                        >
                          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
                            꼬리질문 {exchange.round}
                          </div>
                          {exchange.reason && (
                            <p className="mb-1 leading-relaxed text-muted-foreground">
                              <span className="text-muted-foreground/80">
                                이 질문을 한 이유:{" "}
                              </span>
                              {exchange.reason}
                            </p>
                          )}
                          <p className="leading-relaxed text-foreground">
                            <span className="text-muted-foreground">Q. </span>
                            {exchange.question || "(질문 없음)"}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed text-foreground">
                            <span className="text-muted-foreground">A. </span>
                            {answered ? exchange.answer : "(학생이 답을 포기함)"}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {answered
                              ? "→ 학생이 이 꼬리질문에 답해 해당 부분이 보충되었습니다."
                              : "→ 학생이 답하지 못해 이 부분은 보충되지 않았습니다."}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
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
