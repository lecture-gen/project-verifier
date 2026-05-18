// 최종 판정 (검증 통과 / 추가 확인 필요 / 신뢰 낮음) 의 색상 매핑.

import type { FinalDecision } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

const TONE: Record<FinalDecision, string> = {
  "검증 통과":
    "bg-emerald-100 text-emerald-900 ring-emerald-300/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-700/60",
  "추가 확인 필요":
    "bg-amber-100 text-amber-900 ring-amber-300/60 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-700/60",
  "신뢰 낮음":
    "bg-rose-100 text-rose-900 ring-rose-300/60 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-700/60",
};

export interface VerdictBadgeProps {
  decision: FinalDecision;
  score?: number;
  className?: string;
}

export function VerdictBadge({ decision, score, className }: VerdictBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ring-1",
        TONE[decision],
        className,
      )}
    >
      <span>{decision}</span>
      {typeof score === "number" && (
        <span className="font-mono text-xs opacity-70">
          {Math.round(score * 100)}점
        </span>
      )}
    </span>
  );
}
