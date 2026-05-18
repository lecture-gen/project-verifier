// EvaluationReportRead 의 nested 필드들이 OpenAPI 에서 unknown[] 로 좁혀지지 않으므로
// 명시적인 row 타입으로 narrow 해서 차트와 리스트가 안전하게 소비할 수 있도록 한다.

export interface BloomSummaryRow {
  bloom_level: string;
  question_count: number;
  average_score: number; // 0~100
}

export interface RubricSummaryRow {
  criterion: string;
  average_score: number; // 0~3
  max_score: number;
  question_count: number;
}

export interface AreaAnalysisRow {
  area_name: string;
  decision: string;
  score: number; // 0~100
  summary: string;
}

export interface QuestionEvaluationRow {
  order_index: number;
  question: string;
  score: number; // 0~100
  bloom_level: string;
  summary: string;
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

export function parseRubricSummary(rows: unknown): RubricSummaryRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const criterion = asString(r.criterion);
      if (!criterion) return null;
      return {
        criterion,
        average_score: asNumber(r.average_score),
        max_score: asNumber(r.max_score, 3),
        question_count: asNumber(r.question_count),
      } satisfies RubricSummaryRow;
    })
    .filter((row): row is RubricSummaryRow => row !== null);
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
        bloom_level: asString(r.bloom_level),
        summary: asString(r.summary),
      } satisfies QuestionEvaluationRow;
    })
    .filter((row): row is QuestionEvaluationRow => row !== null);
}
