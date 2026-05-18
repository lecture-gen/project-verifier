// 지원자 입장 폼은 client 인터랙션이지만, evaluationId 는 server 에서 await params 로 받아
// 안전하게 client 컴포넌트에 prop 으로 넘긴다.

import { JoinForm } from "./join-form";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
}

export default async function InterviewJoinPage({ params }: PageProps) {
  const { evaluationId } = await params;
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-6 py-16">
      <JoinForm evaluationId={evaluationId} />
    </div>
  );
}
