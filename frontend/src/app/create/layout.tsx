// 마법사 단계 전체에 공유되는 셸. 좌우 2분할은 WizardShell 이 담당하므로 layout 은
// 페이지 단위 padding 과 배경만 잡는다.

import type { ReactNode } from "react";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {children}
    </div>
  );
}
