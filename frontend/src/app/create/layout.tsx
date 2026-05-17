import { ReactNode } from "react";

export default function CreateLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 bg-muted/20">
      <div className="container mx-auto max-w-3xl px-6 py-10">{children}</div>
    </div>
  );
}
