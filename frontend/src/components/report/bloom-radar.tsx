"use client";

// Nivo ResponsiveRadar 로 Bloom 6단계 도달도를 그린다.

import { ResponsiveRadar } from "@nivo/radar";

import { BLOOM_LEVELS } from "@/lib/wizard/bloom";
import type { BloomSummaryRow } from "./schema";

export interface BloomRadarProps {
  rows: BloomSummaryRow[];
}

export function BloomRadar({ rows }: BloomRadarProps) {
  // bloom_summary 가 누락한 단계는 0 으로 채워 6각형 형태를 유지한다.
  const byLevel = new Map(rows.map((row) => [row.bloom_level, row.average_score]));
  const data = BLOOM_LEVELS.map((level) => ({
    bloom: level,
    "평균 점수": byLevel.get(level) ?? 0,
  }));

  return (
    <div className="h-80 w-full">
      <ResponsiveRadar
        data={data}
        keys={["평균 점수"]}
        indexBy="bloom"
        maxValue={100}
        margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
        gridShape="circular"
        gridLabelOffset={20}
        dotSize={8}
        dotColor={{ theme: "background" }}
        dotBorderWidth={2}
        colors={{ scheme: "category10" }}
        fillOpacity={0.25}
        borderWidth={2}
        ariaLabel="Bloom 단계별 평균 점수 레이더 차트"
      />
    </div>
  );
}
