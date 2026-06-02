// EvaluationReportRead 의 nested 필드들이 OpenAPI 에서 unknown[] 로 좁혀지지 않으므로
// 명시적인 row 타입으로 narrow 해서 차트와 리스트가 안전하게 소비할 수 있도록 한다.

export interface BloomSummaryRow {
  bloom_level: string;
  question_count: number;
  average_score: number; // 0~100 (백분율)
}

export interface RubricBreakdownRow {
  description: string;
  awarded: number;
  max_points: number;
  rationale: string;
}

export interface FollowUpExchangeView {
  round: number;
  question: string;
  answer: string;
  reason: string;
}

export interface QuestionEvaluationRow {
  order_index: number;
  question: string;
  score: number; // 0 ~ max_score
  max_score: number;
  bloom_level: string;
  summary: string;
  rubric_breakdown: RubricBreakdownRow[];
  student_answer: string;
  follow_up_exchanges: FollowUpExchangeView[];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseBloomSummary(rows: unknown): BloomSummaryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const level = asString(r.bloom_level);
      if (!level) return null;
      return {
        bloom_level: level,
        question_count: asNumber(r.question_count),
        average_score: asNumber(r.average_score),
      } satisfies BloomSummaryRow;
    })
    .filter((row): row is BloomSummaryRow => row !== null);
}

function parseRubricBreakdown(rows: unknown): RubricBreakdownRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const description = asString(r.description);
      if (!description) return null;
      return {
        description,
        awarded: asNumber(r.awarded),
        max_points: asNumber(r.max_points, 1),
        rationale: asString(r.rationale),
      } satisfies RubricBreakdownRow;
    })
    .filter((row): row is RubricBreakdownRow => row !== null);
}

function parseFollowUpExchanges(rows: unknown): FollowUpExchangeView[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const round = asNumber(r.round, index + 1);
      return {
        round,
        question: asString(r.question),
        answer: asString(r.answer),
        reason: asString(r.reason),
      } satisfies FollowUpExchangeView;
    })
    .filter((row): row is FollowUpExchangeView => row !== null);
}

export interface QuestionScoreSummary {
  rawTotal: number; // 문제별 획득 점수 합
  rawMax: number; // 문제별 배점 합
  computedNormalized: number; // rawTotal / rawMax * 100
}

// 백엔드 total_score 는 raw 합을 100점 만점으로 정규화한 값(가중치 없음)이므로
// 프론트에서 문제별 점수를 그대로 합산하면 산출 근거를 재현할 수 있다.
export function summarizeQuestionScores(
  rows: QuestionEvaluationRow[],
): QuestionScoreSummary {
  const rawTotal = rows.reduce((sum, row) => sum + row.score, 0);
  const rawMax = rows.reduce((sum, row) => sum + row.max_score, 0);
  const computedNormalized = rawMax > 0 ? (rawTotal / rawMax) * 100 : 0;
  return { rawTotal, rawMax, computedNormalized };
}

export function parseQuestionEvaluations(rows: unknown): QuestionEvaluationRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        order_index: asNumber(r.order_index),
        question: asString(r.question),
        score: asNumber(r.score),
        max_score: asNumber(r.max_score, 1),
        bloom_level: asString(r.bloom_level),
        summary: asString(r.summary),
        rubric_breakdown: parseRubricBreakdown(r.rubric_breakdown),
        student_answer: asString(r.student_answer),
        follow_up_exchanges: parseFollowUpExchanges(r.follow_up_exchanges),
      } satisfies QuestionEvaluationRow;
    })
    .filter((row): row is QuestionEvaluationRow => row !== null);
}
