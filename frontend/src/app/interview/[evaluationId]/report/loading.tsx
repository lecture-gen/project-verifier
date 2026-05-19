// Next.js loading boundary: SSR fetch (`completeSession`) 동안 ReportSkeleton 을 렌더한다.
// 데이터가 빠르게 도착하면 거의 보이지 않을 수 있다 — 의도된 동작.

import { ReportSkeleton } from "@/components/report/report-skeleton";

export default function Loading() {
  return <ReportSkeleton />;
}
