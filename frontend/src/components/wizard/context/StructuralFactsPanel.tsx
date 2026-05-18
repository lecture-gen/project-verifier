"use client";

// zip 에서 결정적으로 추출된 구조 통계 패널.
// 파일 수, 총 LOC, 언어별 LOC (Nivo bar), test_ratio 를 한눈에 보여준다.

import { ResponsiveBar } from "@nivo/bar";

import type { StructuralFacts } from "@/lib/api/context-types";

export function StructuralFactsPanel({ facts }: { facts: StructuralFacts }) {
  if (!facts || facts.file_count === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        구조 통계가 추출되지 않았습니다.
      </p>
    );
  }

  const testRatioPct = (facts.test_ratio * 100).toFixed(1);
  const languages = (facts.language_loc ?? []).slice(0, 10).map((entry) => ({
    language: entry.language,
    loc: entry.loc,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="총 파일 수" value={facts.file_count} />
        <Stat label="코드 파일" value={facts.code_file_count} />
        <Stat label="문서 파일" value={facts.doc_file_count} />
        <Stat label="총 LOC" value={facts.total_loc.toLocaleString()} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="test 파일 비율"
          value={`${testRatioPct}%`}
          tone={facts.test_ratio >= 0.05 ? "success" : "muted"}
        />
        <Stat label="진입점 후보" value={facts.entry_point_candidates?.length ?? 0} />
        <Stat label="의존성 항목" value={facts.dependencies?.length ?? 0} />
        <Stat label="언어 수" value={facts.language_loc?.length ?? 0} />
      </div>
      {languages.length > 0 && (
        <div className="rounded border border-border/60 p-3">
          <h5 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            언어별 LOC
          </h5>
          <div style={{ height: 240 }}>
            <ResponsiveBar
              data={languages}
              keys={["loc"]}
              indexBy="language"
              margin={{ top: 8, right: 16, bottom: 48, left: 56 }}
              padding={0.3}
              colors={{ scheme: "blue_purple" }}
              axisBottom={{ tickRotation: -25 }}
              axisLeft={{ tickSize: 4 }}
              labelSkipHeight={12}
              labelTextColor="#fff"
              tooltipLabel={(d) => `${d.indexValue}`}
            />
          </div>
        </div>
      )}
      {facts.entry_point_candidates?.length > 0 && (
        <div>
          <h5 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            진입점 후보
          </h5>
          <ul className="space-y-1 text-sm">
            {facts.entry_point_candidates.map((path) => (
              <li key={path} className="font-mono text-xs">
                {path}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "success" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="rounded border border-border/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-serif text-xl ${toneClass}`}>{value}</div>
    </div>
  );
}
