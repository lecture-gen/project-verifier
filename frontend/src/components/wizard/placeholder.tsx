import { ReactNode } from "react";

interface PlaceholderProps {
  title: string;
  description: string;
  children?: ReactNode;
}

export function Placeholder({ title, description, children }: PlaceholderProps) {
  return (
    <section className="container mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
