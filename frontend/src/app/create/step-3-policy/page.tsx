"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { ApiError } from "@/lib/api/client";
import { useUpdateQuestionPolicy } from "@/lib/api/mutations";
import { useEvaluation } from "@/lib/api/queries";
import {
  BLOOM_LEVELS,
  BLOOM_LEVEL_META,
  calculateBloomDistribution,
  defaultBloomRatios,
} from "@/lib/wizard/bloom";
import { useWizardGuard } from "@/lib/wizard/guard";
import { useWizardState } from "@/lib/wizard/state";
import type { BloomLevel } from "@/lib/api/endpoints";

const TOTAL_MIN = 1;
const TOTAL_MAX = 20;
const RATIO_MIN = 0;
const RATIO_MAX = 10;

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function WizardStep3Page() {
  const router = useRouter();
  const guard = useWizardGuard({ step: 3, minStepCompleted: 2 });
  const { policyDraft, setPolicyDraft, markStepCompleted } = useWizardState();

  const evaluationId = guard?.evaluationId ?? "";
  const adminPassword = guard?.adminPassword ?? "";

  const evaluationQuery = useEvaluation(evaluationId, adminPassword, {
    enabled: Boolean(evaluationId && adminPassword),
  });
  const mutation = useUpdateQuestionPolicy(evaluationId, adminPassword);

  const initial = useMemo(() => {
    const existing = evaluationQuery.data?.question_policy;
    if (policyDraft) return policyDraft;
    if (existing) {
      return {
        total_question_count: existing.total_question_count ?? 6,
        bloom_ratios: { ...defaultBloomRatios(), ...(existing.bloom_ratios ?? {}) },
      };
    }
    return { total_question_count: 6, bloom_ratios: defaultBloomRatios() };
  }, [evaluationQuery.data, policyDraft]);

  const [total, setTotal] = useState<number>(initial.total_question_count);
  const [ratios, setRatios] = useState<Record<string, number>>(initial.bloom_ratios);

  const distribution = useMemo(
    () => calculateBloomDistribution(total, ratios),
    [total, ratios],
  );
  const ratioSum = BLOOM_LEVELS.reduce((sum, level) => sum + (ratios[level] ?? 0), 0);

  if (!guard) return null;

  function updateRatio(level: BloomLevel, value: number) {
    setRatios((prev) => ({ ...prev, [level]: value }));
  }

  async function onSubmit() {
    if (ratioSum === 0) {
      toast.error("Bloom 단계 비율 합이 0 입니다. 최소 한 단계 이상 1 이상으로 두세요.");
      return;
    }
    const payload = {
      total_question_count: total,
      bloom_ratios: ratios,
    };
    setPolicyDraft(payload);
    try {
      await mutation.mutateAsync({ question_policy: payload });
      markStepCompleted(3);
      toast.success("질문 정책을 저장했습니다.");
      router.push("/create/step-4-questions");
    } catch (error) {
      toast.error(describeError(error, "질문 정책 저장에 실패했습니다."));
    }
  }

  return (
    <WizardShell
      step={3}
      title="질문 정책을 정의합니다."
      description={
        <>
          <p>
            총 문항 수와 Bloom 단계별 비율로 질문 분포를 정의합니다. 비율 합이 0이면
            저장할 수 없습니다.
          </p>
          <p className="mt-3 text-sm">
            동률 잔여 문항은 기억 → 이해 → 적용 → 분석 → 평가 → 창안 순으로 배정됩니다.
          </p>
        </>
      }
      previousLabel="자료 분석"
      nextLabel="질문 검토"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/create/step-2-upload")}
          >
            ← 이전
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={mutation.isPending || ratioSum === 0}
          >
            {mutation.isPending ? "저장 중…" : "다음 단계"}
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">총 문항 수</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              {TOTAL_MIN} ~ {TOTAL_MAX} 문항
            </span>
            <span className="font-serif text-3xl">{total}</span>
          </div>
          <Slider
            value={[total]}
            min={TOTAL_MIN}
            max={TOTAL_MAX}
            step={1}
            onValueChange={(values) => setTotal(values[0] ?? TOTAL_MIN)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bloom 단계별 비율</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {BLOOM_LEVELS.map((level) => {
            const meta = BLOOM_LEVEL_META[level];
            const value = ratios[level] ?? 0;
            const planned = distribution[level];
            return (
              <div key={level} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">{meta.title}</div>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <div className="text-muted-foreground">비율 {value}</div>
                    <div className="font-serif text-lg text-foreground">
                      {planned} 문항
                    </div>
                  </div>
                </div>
                <Slider
                  value={[value]}
                  min={RATIO_MIN}
                  max={RATIO_MAX}
                  step={1}
                  onValueChange={(values) => updateRatio(level, values[0] ?? 0)}
                />
              </div>
            );
          })}
          <div className="border-t border-border/60 pt-3 text-sm text-muted-foreground">
            현재 비율 합 <span className="text-foreground">{ratioSum}</span> ·
            {" "}예정 문항 수 합{" "}
            <span className="text-foreground">
              {BLOOM_LEVELS.reduce((sum, level) => sum + distribution[level], 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </WizardShell>
  );
}
