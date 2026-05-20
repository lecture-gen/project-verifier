"use client";

// 학생이 이 프로젝트를 구현하며 부딪혔을 만한 난점 — 카드 그리드.
// 각 필드 앞에 "영역 / 난점 / 왜 어려운가" 라벨을 명시해 한눈에 의미가 잡히도록 한다.
// 근거(evidence_path)는 학생/교수자 UI에서 노출하지 않는다.

import type { StudentImplementationRisk } from "@/lib/api/context-types";

export function StudentRisksCards({
  risks,
}: {
  risks: StudentImplementationRisk[];
}) {
  if (!risks || risks.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        식별된 구현 난점이 없습니다.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {risks.map((risk, idx) => (
        <li
          key={`${risk.area}-${idx}`}
          className="space-y-3 rounded border border-border/60 bg-card px-4 py-3 shadow-sm"
        >
          <RiskField label="영역">{risk.area || "(영역 미지정)"}</RiskField>
          <RiskField label="난점" emphasis>
            {risk.challenge}
          </RiskField>
          {risk.why_difficult && (
            <RiskField label="왜 어려운가">{risk.why_difficult}</RiskField>
          )}
        </li>
      ))}
    </ul>
  );
}

function RiskField({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <p
        className={
          emphasis
            ? "text-sm font-medium leading-relaxed text-foreground"
            : "text-sm leading-relaxed text-muted-foreground"
        }
      >
        {children}
      </p>
    </div>
  );
}
