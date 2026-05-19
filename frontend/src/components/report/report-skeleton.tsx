// 리포트 페이지의 SSR fetch 동안 보여줄 placeholder.
// report-view.tsx 의 섹션 구조(최종 판정 → Bloom 레이더 → 영역 → 패널 → 문제별 채점)를 미러링한다.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-3/4" />
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-7 w-32" />
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-5 w-12" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2 pb-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto h-56 w-full max-w-md rounded-md" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded border border-border/60 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-4/5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-3 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded border border-border/60 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="mt-2 h-3 w-3/4" />
                <div className="mt-3 space-y-2 rounded-md border border-border/60 p-3">
                  {[0, 1, 2].map((line) => (
                    <div
                      key={line}
                      className="flex items-center justify-between gap-3"
                    >
                      <Skeleton className="h-3 w-3/5" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
