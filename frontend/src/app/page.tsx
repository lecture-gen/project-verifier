import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex-1 container mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="text-sm font-medium text-muted-foreground">
          Dialearn / 프로젝트 진위 검증 인터뷰
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          지원자가 이 프로젝트를 진짜로 수행했는지 확인합니다.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          단일 zip 자료를 분석해 자료 근거 기반 질문을 만들고, 인터뷰 답변을
          Bloom&apos;s Taxonomy와 루브릭으로 평가합니다.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>교수자 — 평가 방 만들기</CardTitle>
            <CardDescription>
              프로젝트 자료를 업로드하고 질문 정책을 정한 뒤 지원자 입장 링크를
              발급합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full">
              <Link href="/create/step-1-info">새 평가 방 만들기</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>교수자 — 기존 방 관리</CardTitle>
            <CardDescription>
              생성한 평가 방의 상태, 질문, 리포트를 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/admin">방 목록 열기</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-12 rounded-lg border bg-muted/30 p-6">
        <h2 className="text-lg font-medium">지원자이신가요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          교수자로부터 받은 인터뷰 입장 링크를 그대로 열어 주세요. 별도의 회원
          가입은 필요하지 않습니다.
        </p>
      </section>
    </main>
  );
}
