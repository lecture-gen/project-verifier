// Bloom 6단계 정의 + 비율→예정 문항 수 분포 계산.
// ui_helpers.calculate_bloom_distribution 의 동작을 그대로 옮긴다.

import type { BloomLevel } from "@/lib/api/endpoints";

export const BLOOM_LEVELS: readonly BloomLevel[] = [
  "기억",
  "이해",
  "적용",
  "분석",
  "평가",
  "창안",
] as const;

export interface BloomLevelMeta {
  level: BloomLevel;
  title: string;
  description: string;
}

export const BLOOM_LEVEL_META: Record<BloomLevel, BloomLevelMeta> = {
  기억: {
    level: "기억",
    title: "기억",
    description: "사실, 정의, 절차를 그대로 재현할 수 있는지 확인합니다.",
  },
  이해: {
    level: "이해",
    title: "이해",
    description: "구성 요소와 흐름을 자기 말로 설명할 수 있는지 확인합니다.",
  },
  적용: {
    level: "적용",
    title: "적용",
    description: "주어진 상황에 알맞게 기법을 사용할 수 있는지 확인합니다.",
  },
  분석: {
    level: "분석",
    title: "분석",
    description: "원인과 구조를 쪼개 의존 관계를 설명할 수 있는지 확인합니다.",
  },
  평가: {
    level: "평가",
    title: "평가",
    description: "트레이드오프와 한계를 판단해 의사결정을 변호할 수 있는지 확인합니다.",
  },
  창안: {
    level: "창안",
    title: "창안",
    description: "조건이 바뀌었을 때 대안을 새로 설계할 수 있는지 확인합니다.",
  },
};

export interface BloomPreset {
  total: number;
  ratios: Record<BloomLevel, number>;
}

// Stage 1 의 project_category 와 동일한 키. dropdown 자동 매칭 용도.
export const BLOOM_PRESETS: Record<
  "weekly" | "midterm" | "final" | "capstone_final",
  BloomPreset
> = {
  weekly: {
    total: 5,
    ratios: { 기억: 3, 이해: 3, 적용: 0, 분석: 0, 평가: 0, 창안: 0 },
  },
  midterm: {
    total: 8,
    ratios: { 기억: 3, 이해: 3, 적용: 2, 분석: 2, 평가: 0, 창안: 0 },
  },
  final: {
    total: 10,
    ratios: { 기억: 2, 이해: 3, 적용: 2, 분석: 2, 평가: 1, 창안: 0 },
  },
  capstone_final: {
    total: 10,
    ratios: { 기억: 0, 이해: 3, 적용: 3, 분석: 1, 평가: 1, 창안: 0 },
  },
};

export const BLOOM_PRESET_OPTIONS: Array<{
  value: "weekly" | "midterm" | "final" | "capstone_final";
  label: string;
}> = [
  { value: "weekly", label: "주간" },
  { value: "midterm", label: "중간" },
  { value: "final", label: "기말" },
  { value: "capstone_final", label: "최종" },
];

export function ratiosEqual(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  return BLOOM_LEVELS.every(
    (level) => (a[level] ?? 0) === (b[level] ?? 0),
  );
}

export function findMatchingPreset(
  total: number,
  ratios: Record<string, number>,
): "weekly" | "midterm" | "final" | "capstone_final" | null {
  for (const [key, preset] of Object.entries(BLOOM_PRESETS)) {
    if (preset.total === total && ratiosEqual(preset.ratios, ratios)) {
      return key as "weekly" | "midterm" | "final" | "capstone_final";
    }
  }
  return null;
}

export function defaultBloomRatios(): Record<BloomLevel, number> {
  // 기존 백엔드 기본값과 유사한 균등 분포에서 시작.
  return BLOOM_LEVELS.reduce(
    (acc, level) => {
      acc[level] = 1;
      return acc;
    },
    {} as Record<BloomLevel, number>,
  );
}

/**
 * 총 문항 수와 Bloom 단계별 비율을 받아 예정 문항 수를 계산한다.
 *
 * 알고리즘 (Python 원본과 동일):
 * 1. ratio_sum == 0 이면 모든 단계 0.
 * 2. raw = total * ratio / ratio_sum.
 * 3. floor 한 값을 planned 로, 남은 문항은 raw 소수부가 큰 순서로 +1.
 * 4. 동률은 BLOOM_LEVELS 순서를 따른다.
 */
export function calculateBloomDistribution(
  totalQuestions: number,
  ratios: Record<string, number>,
): Record<BloomLevel, number> {
  const planned: Record<BloomLevel, number> = BLOOM_LEVELS.reduce(
    (acc, level) => {
      acc[level] = 0;
      return acc;
    },
    {} as Record<BloomLevel, number>,
  );

  const ratioSum = BLOOM_LEVELS.reduce(
    (sum, level) => sum + (ratios[level] ?? 0),
    0,
  );
  if (ratioSum === 0 || totalQuestions <= 0) return planned;

  const raw: Record<BloomLevel, number> = BLOOM_LEVELS.reduce(
    (acc, level) => {
      acc[level] = (totalQuestions * (ratios[level] ?? 0)) / ratioSum;
      return acc;
    },
    {} as Record<BloomLevel, number>,
  );

  for (const level of BLOOM_LEVELS) {
    planned[level] = Math.floor(raw[level]);
  }

  const placed = BLOOM_LEVELS.reduce((sum, level) => sum + planned[level], 0);
  let remaining = totalQuestions - placed;
  if (remaining <= 0) return planned;

  const ordered = [...BLOOM_LEVELS].sort((a, b) => {
    const remainderDiff = raw[b] - planned[b] - (raw[a] - planned[a]);
    if (remainderDiff !== 0) return remainderDiff;
    return BLOOM_LEVELS.indexOf(a) - BLOOM_LEVELS.indexOf(b);
  });

  for (const level of ordered) {
    if (remaining === 0) break;
    planned[level] += 1;
    remaining -= 1;
  }
  return planned;
}
