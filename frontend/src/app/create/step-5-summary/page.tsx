"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { useAdminQuestions, useEvaluation } from "@/lib/api/queries";
import { useWizardGuard } from "@/lib/wizard/guard";
import { useWizardState } from "@/lib/wizard/state";

// window.location.origin 은 한 번 읽으면 변하지 않으므로 빈 subscribe.
function subscribeNoop(): () => void {
  return () => {};
}

export default function WizardStep5Page() {
  const router = useRouter();
  const guard = useWizardGuard({ step: 5, minStepCompleted: 4 });
  const { info, markStepCompleted } = useWizardState();

  const evaluationId = guard?.evaluationId ?? "";
  const adminPassword = guard?.adminPassword ?? "";

  const evaluationQuery = useEvaluation(evaluationId, adminPassword, {
    enabled: Boolean(evaluationId && adminPassword),
  });
  const questionsQuery = useAdminQuestions(evaluationId, adminPassword, {
    enabled: Boolean(evaluationId && adminPassword),
  });

  const origin = useSyncExternalStore(
    subscribeNoop,
    () => (typeof window === "undefined" ? "" : window.location.origin),
    () => "",
  );

  useEffect(() => {
    if (guard) markStepCompleted(5);
  }, [guard, markStepCompleted]);

  const studentUrl = useMemo(() => {
    if (!evaluationId) return "";
    const base = origin || "";
    return `${base}/interview/${evaluationId}/join`;
  }, [evaluationId, origin]);

  if (!guard) return null;

  const evaluation = evaluationQuery.data;
  const questions = questionsQuery.data ?? [];
  const policy = evaluation?.question_policy;

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} 을(를) 복사했습니다.`);
    } catch {
      toast.error("클립보드 접근이 차단되었습니다. 직접 선택해 복사하세요.");
    }
  }

  return (
    <WizardShell
      step={5}
      title="학생에게 공유합니다."
      description={
        <>
          <p>
            학생에게 공유할 입장 URL과 비밀번호를 안내합니다. 학생은 로그인 없이 이
            정보만으로 인터뷰에 진입합니다.
          </p>
          <p className="mt-3 text-sm">
            관리 콘솔에서는 자료, 질문, 진행 상황, 리포트를 모두 확인할 수 있습니다.
          </p>
        </>
      }
      previousLabel="질문 검토"
      nextLabel="관리 콘솔"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/")}
          >
            홈으로
          </Button>
          <Button
            type="button"
            onClick={() => router.push(`/admin/${evaluationId}`)}
            disabled={!evaluationId}
          >
            관리 콘솔로 이동
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">학생 공유 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SharedField
            label="학생 입장 URL"
            value={studentUrl}
            onCopy={() => copy(studentUrl, "학생 입장 URL")}
          />
          <SharedField
            label="평가 ID"
            value={evaluationId}
            onCopy={() => copy(evaluationId, "평가 ID")}
          />
          <SharedField
            label="학생 입장 비밀번호"
            value={info?.room_password ?? ""}
            onCopy={() => copy(info?.room_password ?? "", "학생 입장 비밀번호")}
            placeholder="(브라우저 메모리에서만 보관 — 1단계에서 입력한 값)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">평가 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="방 이름" value={evaluation?.room_name || info?.room_name} />
          <Row
            label="프로젝트"
            value={evaluation?.project_name || info?.project_name}
          />
          <Row
            label="지원자 / 팀"
            value={evaluation?.candidate_name || info?.candidate_name}
          />
          <Separator />
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              질문 정책
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                총 {policy?.total_question_count ?? "-"} 문항
              </Badge>
              {policy?.bloom_distribution &&
                Object.entries(policy.bloom_distribution).map(([level, count]) => (
                  <Badge key={level} variant="secondary">
                    {level} · {count}
                  </Badge>
                ))}
            </div>
          </div>
          <Row label="생성된 질문 수" value={String(questions.length)} />
        </CardContent>
      </Card>
    </WizardShell>
  );
}

function SharedField({
  label,
  value,
  onCopy,
  placeholder,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCopy}
          disabled={!value}
        >
          <Copy />
          복사
        </Button>
      </div>
      <div className="rounded border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm">
        {value || (
          <span className="text-muted-foreground">{placeholder ?? "(값 없음)"}</span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-foreground">{value || "-"}</span>
    </div>
  );
}
