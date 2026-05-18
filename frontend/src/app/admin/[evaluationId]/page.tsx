// 관리 콘솔 server entry. evaluationId 를 await 한 뒤 client 콘솔에 prop 으로 넘긴다.

import { AdminConsole } from "./admin-console";

interface PageProps {
  params: Promise<{ evaluationId: string }>;
}

export default async function AdminEvaluationPage({ params }: PageProps) {
  const { evaluationId } = await params;
  return <AdminConsole evaluationId={evaluationId} />;
}
