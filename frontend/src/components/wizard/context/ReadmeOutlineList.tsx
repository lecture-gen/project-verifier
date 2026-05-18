"use client";

// README 헤더 트리 — markdown 의 # / ## / ### 를 그대로 indent 로 표시.

import type { ReadmeOutlineEntry } from "@/lib/api/context-types";

export function ReadmeOutlineList({ entries }: { entries: ReadmeOutlineEntry[] }) {
  if (!entries || entries.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        README 헤더를 찾을 수 없습니다.
      </p>
    );
  }

  const sourcePath = entries[0]?.source_path;
  return (
    <div className="space-y-2">
      {sourcePath && (
        <p className="font-mono text-[11px] text-muted-foreground">
          소스: {sourcePath}
        </p>
      )}
      <ul className="space-y-1 text-sm">
        {entries.map((entry, idx) => (
          <li
            key={`${entry.text}-${idx}`}
            style={{ paddingLeft: `${(entry.level - 1) * 14}px` }}
            className={entry.level === 1 ? "font-semibold" : "text-foreground/90"}
          >
            {"#".repeat(Math.min(entry.level, 4))} {entry.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
