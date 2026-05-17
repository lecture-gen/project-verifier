import { Placeholder } from "@/components/wizard/placeholder";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
}

export default async function InterviewReportPage({ params }: PageProps) {
  const { evaluationId } = await params;
  return (
    <Placeholder
      title="인터뷰 리포트"
      description={`Phase 9에서 평가 ${evaluationId}의 verdict / 루브릭 / Bloom / 증거 패널을 구현합니다.`}
    />
  );
}
