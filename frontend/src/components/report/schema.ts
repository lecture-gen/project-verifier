// EvaluationReportRead 의 nested 필드들이 OpenAPI 에서 unknown[] 로 좁혀지지 않으므로
// 명시적인 row 타입으로 narrow 해서 차트와 리스트가 안전하게 소비할 수 있도록 한다.

export interface BloomSummaryRow {
  bloom_level: string;
  question_count: number;
  average_score: number; // 0~100 (백분율)
}

export interface AreaAnalysisRow {
  area_name: string;
  decision: string;
  score: number; // 0~100
  summary: string;
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

export function parseAreaAnalyses(rows: unknown): AreaAnalysisRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const name = asString(r.area_name);
      if (!name) return null;
      return {
        area_name: name,
        decision: asString(r.decision),
        score: asNumber(r.score),
        summary: asString(r.summary),
      } satisfies AreaAnalysisRow;
    })
    .filter((row): row is AreaAnalysisRow => row !== null);
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
