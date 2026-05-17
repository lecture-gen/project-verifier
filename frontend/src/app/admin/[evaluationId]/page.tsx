import { Placeholder } from "@/components/wizard/placeholder";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
}

export default async function AdminEvaluationPage({ params }: PageProps) {
  const { evaluationId } = await params;
  return (
    <Placeholder
      title={`방 관리 콘솔 — ${evaluationId}`}
      description="Phase 8에서 admin password 게이트와 상태/질문/리포트 탭을 구현합니다."
    />
  );
}
