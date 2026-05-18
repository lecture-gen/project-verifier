"use client";

// 7개 루브릭 평균 점수 (0~3) 를 Nivo ResponsiveBar 로 표시.

import { ResponsiveBar } from "@nivo/bar";

import type { RubricSummaryRow } from "./schema";

export interface RubricChartProps {
  rows: RubricSummaryRow[];
}

const OVERALL_LABEL = "overall";

export function RubricChart({ rows }: RubricChartProps) {
  // overall 은 0~3 점이 아니라 0~100 평균이므로 별도 처리. 차트는 criterion 단위만 보여준다.
  const data = rows
    .filter((row) => row.criterion !== OVERALL_LABEL)
    .map((row) => ({
      criterion: row.criterion,
      "평균 점수": Number(row.average_score.toFixed(2)),
    }));

  if (data.length === 0) return null;

  return (
    <div className="h-80 w-full">
      <ResponsiveBar
        data={data}
        keys={["평균 점수"]}
        indexBy="criterion"
        layout="horizontal"
        margin={{ top: 16, right: 24, bottom: 32, left: 130 }}
        padding={0.3}
        valueScale={{ type: "linear", min: 0, max: 3 }}
        colors={{ scheme: "purple_blue" }}
        borderRadius={4}
        axisBottom={{
          tickValues: [0, 1, 2, 3],
          legend: "평균 점수 (0~3)",
          legendPosition: "middle",
          legendOffset: 28,
        }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        labelTextColor="#fff"
        ariaLabel="루브릭 평균 점수"
      />
    </div>
  );
}
