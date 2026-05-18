"use client";

// zip 내부 파일 트리 — depth 별 indent 로 표현. 외부 트리 라이브러리 의존성 없음.
// 큰 트리에서도 초기 펼침은 depth <= 1 만, 나머지는 details 로 접는다.

import type { FileTreeNode } from "@/lib/api/context-types";

export function FileTreeView({ tree }: { tree: FileTreeNode[] }) {
  if (!tree || tree.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        파일 트리가 비어 있습니다.
      </p>
    );
  }

  // 평탄화된 노드 리스트를 depth 기반 indent 로 그대로 렌더한다.
  // (대용량을 다루는 명시적 트리 구조는 캡스톤 범위 밖.)
  return (
    <div className="max-h-80 overflow-auto rounded border border-border/60 bg-muted/20 p-3 font-mono text-[12px] leading-relaxed">
      <ul>
        {tree.map((node) => (
          <li
            key={node.path}
            style={{ paddingLeft: `${node.depth * 14}px` }}
            className={
              node.kind === "dir"
                ? "text-foreground"
                : "text-muted-foreground"
            }
          >
            {node.kind === "dir" ? "📁 " : "📄 "}
            {basename(node.path)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function basename(path: string): string {
  const segments = path.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}
