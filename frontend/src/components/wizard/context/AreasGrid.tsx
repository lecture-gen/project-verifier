"use client";

// 프로젝트 영역 그리드 — 검증 질문 단위가 되는 핵심 영역들을 카드로 표시.
// 상단에 영역의 목적(부제)을 명시한다. 사용자가 이 필드의 의미를 헷갈리지 않도록.

import { Badge } from "@/components/ui/badge";
import type { ProjectAreaContext } from "@/lib/api/context-types";

export function AreasGrid({ areas }: { areas: ProjectAreaContext[] }) {
  if (!areas || areas.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        분석된 영역이 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        검증 질문이 출제되는 단위 영역입니다. 영역별로 학생에게 어떤 점을 확인할지
        파악할 수 있도록 정리됩니다.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {areas.map((area) => (
          <li
            key={area.id}
            className="rounded border border-border/60 bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{area.name}</span>
              <Badge variant="outline" className="text-[10px]">
                신뢰도 {(area.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
            {area.role_in_project && (
              <p className="mt-2 text-xs text-muted-foreground">
                역할 — {area.role_in_project}
              </p>
            )}
            {area.summary && (
              <p className="mt-2 text-sm">{area.summary}</p>
            )}
            {area.key_concerns?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {area.key_concerns.map((concern, idx) => (
                  <Badge
                    key={`${concern}-${idx}`}
                    variant="secondary"
                    className="text-[10px]"
                  >
                    {concern}
                  </Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
