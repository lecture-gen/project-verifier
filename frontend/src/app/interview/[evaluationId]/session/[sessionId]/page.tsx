import { Placeholder } from "@/components/wizard/placeholder";

interface PageProps {
  params: Promise<{ evaluationId: string; sessionId: string }>;
}

export default async function InterviewSessionPage({ params }: PageProps) {
  const { evaluationId, sessionId } = await params;
  return (
    <Placeholder
      title="인터뷰 진행"
      description={`Phase 6/7에서 평가 ${evaluationId} 세션 ${sessionId}의 질문/답변/오디오 흐름을 구현합니다.`}
    />
  );
}
