import { Placeholder } from "@/components/wizard/placeholder";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
}

export default async function InterviewJoinPage({ params }: PageProps) {
  const { evaluationId } = await params;
  return (
    <Placeholder
      title={`인터뷰 입장 — ${evaluationId}`}
      description="Phase 6에서 지원자 이름과 방 비밀번호 입력 후 세션 생성 흐름을 구현합니다."
    />
  );
}
