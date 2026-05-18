// 단일 페이지 마법사를 감싸는 layout. WizardProvider 로 마법사 상태를 메모리에 보관한다.

import type { ReactNode } from "react";

import { WizardProvider } from "@/lib/wizard/state";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <WizardProvider>{children}</WizardProvider>
    </div>
  );
}
