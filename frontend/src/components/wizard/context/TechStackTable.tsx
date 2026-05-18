"use client";

// 기술 스택 — category 별로 그룹핑한 표.
// 각 항목: name (큰 글자) · category 배지 · role_in_project (본문) · evidence_path (작은 글씨)

import { Badge } from "@/components/ui/badge";
import type { TechStackItem } from "@/lib/api/context-types";

const CATEGORY_LABEL: Record<string, string> = {
  language: "언어",
  framework: "프레임워크",
  database: "데이터베이스",
  infra: "인프라",
  library: "라이브러리",
  tool: "도구",
};

const CATEGORY_ORDER = ["framework", "language", "database", "infra", "library", "tool"];

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function TechStackTable({ items }: { items: TechStackItem[] }) {
  if (!items || items.length === 0) {
    return (
      <EmptyHint message="제출 자료에서 식별 가능한 기술 스택이 없습니다." />
    );
  }

  const grouped = new Map<string, TechStackItem[]>();
  for (const item of items) {
    const key = item.category || "etc";
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  const orderedGroups = Array.from(grouped.entries()).sort(
    (a, b) => categoryRank(a[0]) - categoryRank(b[0]),
  );

  return (
    <div className="space-y-4">
      {orderedGroups.map(([category, entries]) => (
        <div key={category}>
          <h5 className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {CATEGORY_LABEL[category] ?? category}
          </h5>
          <ul className="grid gap-2">
            {entries.map((item, idx) => (
              <li
                key={`${item.name}-${idx}`}
                className="rounded border border-border/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-semibold">{item.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_LABEL[item.category] ?? item.category}
                  </Badge>
                </div>
                {item.role_in_project && (
                  <p className="mt-1 text-sm text-foreground/90">
                    {item.role_in_project}
                  </p>
                )}
                {item.evidence_path && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    근거: {item.evidence_path}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
      {message}
    </p>
  );
}
