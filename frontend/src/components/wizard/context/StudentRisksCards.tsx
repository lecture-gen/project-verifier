"use client";

// 학생이 이 프로젝트를 구현하며 부딪혔을 만한 난점 — 카드 그리드.
// 보안 공격이나 코드 결함이 아니라 "구현 과정의 어려움" 시각으로 작성된 항목들.

import { Badge } from "@/components/ui/badge";
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
          className="rounded border border-border/60 bg-card px-4 py-3 shadow-sm"
        >
          <Badge variant="outline" className="text-[10px]">
            {risk.area || "(영역 미지정)"}
          </Badge>
          <p className="mt-2 text-sm font-medium text-foreground">
            {risk.challenge}
          </p>
          {risk.why_difficult && (
            <p className="mt-2 text-sm text-muted-foreground">
              왜 어려운가 — {risk.why_difficult}
            </p>
          )}
          {risk.evidence_path && (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              근거: {risk.evidence_path}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
