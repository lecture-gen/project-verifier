"use client";

// 의존성 manifest 별로 그룹핑한 패키지 목록.
// package.json / requirements.txt / pyproject.toml / pom.xml / go.mod / Cargo.toml 등.

import type { DependencyEntry } from "@/lib/api/context-types";

export function DependencyList({ items }: { items: DependencyEntry[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        의존성 manifest 가 식별되지 않았습니다.
      </p>
    );
  }

  const grouped = new Map<string, DependencyEntry[]>();
  for (const item of items) {
    const bucket = grouped.get(item.manifest) ?? [];
    bucket.push(item);
    grouped.set(item.manifest, bucket);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([manifest, entries]) => (
        <div key={manifest}>
          <h5 className="mb-2 font-mono text-[11px] text-muted-foreground">
            {manifest} · {entries.length}개
          </h5>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {entries.map((entry, idx) => (
              <li
                key={`${entry.name}-${idx}`}
                className="flex items-baseline justify-between gap-2 rounded border border-border/60 px-2 py-1 text-xs"
              >
                <span className="font-mono">{entry.name}</span>
                {entry.version && (
                  <span className="font-mono text-muted-foreground">
                    {entry.version}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
