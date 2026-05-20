// 비동기 버튼·로딩 상태에서 텍스트 대신 사용하는 공통 스피너.
// lucide-react 의 Loader2 + tailwind animate-spin 만 사용.

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  // 픽셀 단위. 기본 16. icon 사이즈 슬롯에 들어가는 곳에서는 14~16 권장.
  size?: number;
}

export function Spinner({ className, size = 16 }: SpinnerProps) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("animate-spin", className)}
      style={{ width: size, height: size }}
    />
  );
}
