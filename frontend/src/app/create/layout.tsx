// 단일 페이지 마법사 layout. WizardProvider 로 메모리 상태를 보관하고
// 페이지 자체가 viewport 높이에 고정되도록 h-dvh + overflow-hidden 으로 통제한다.

import type { ReactNode } from "react";

import { WizardProvider } from "@/lib/wizard/state";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background">
      <WizardProvider>{children}</WizardProvider>
    </div>
  );
}
