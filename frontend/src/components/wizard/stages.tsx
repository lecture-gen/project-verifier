"use client";

// 단일 페이지 마법사의 5개 stage 본문을 한곳에 모아 둔다.
// 각 stage 는 WizardShell 안에 자기 폼/콘텐츠를 렌더하고,
// 완료 시 wizard state(markStepCompleted/setEvaluation/...) 를 갱신해 다음 stage 로 슬라이드 전환을 유도한다.

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ZipUploadPipeline } from "@/components/wizard/zip-upload-pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { ApiError } from "@/lib/api/client";
import {
  useCreateEvaluation,
  useGenerateQuestions,
  useUpdateQuestionPolicy,
} from "@/lib/api/mutations";
import {
  useAdminQuestions,
  useEvaluation,
  useEvaluationStatus,
} from "@/lib/api/queries";
import type { BloomLevel, InterviewQuestionRead } from "@/lib/api/endpoints";
import {
  BLOOM_LEVELS,
  BLOOM_LEVEL_META,
  calculateBloomDistribution,
  defaultBloomRatios,
} from "@/lib/wizard/bloom";
import { useWizardState } from "@/lib/wizard/state";

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

// =====================================================================
// Stage 1 — 방 정보
// =====================================================================

const infoSchema = z.object({
  room_name: z.string().trim().min(1, "방 이름을 입력하세요."),
  project_name: z.string().trim().min(1, "프로젝트명을 입력하세요."),
  candidate_name: z.string().trim(),
  description: z.string().trim(),
  room_password: z.string().min(4, "학생 입장 비밀번호는 4자 이상으로 정해주세요."),
});

type InfoFormValues = z.infer<typeof infoSchema>;

export function Stage1Info() {
  const { info, setEvaluation } = useWizardState();
  const mutation = useCreateEvaluation();

  const form = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      room_name: info?.room_name ?? "",
      project_name: info?.project_name ?? "",
      candidate_name: info?.candidate_name ?? "",
      description: info?.description ?? "",
      room_password: info?.room_password ?? "",
    },
  });

  async function onSubmit(values: InfoFormValues) {
    try {
      const created = await mutation.mutateAsync({
        project_name: values.project_name,
        candidate_name: values.candidate_name,
        description: values.description,
        room_name: values.room_name || values.project_name,
        room_password: values.room_password,
      });
      setEvaluation(created.id, {
        room_name: created.room_name || values.project_name,
        project_name: created.project_name,
        candidate_name: created.candidate_name,
        description: created.description,
        room_password: values.room_password,
      });
      toast.success(`방을 만들었습니다.`);
    } catch (error) {
      toast.error(describeError(error, "방 생성에 실패했습니다."));
    }
  }

  return (
    <WizardShell
      step={1}
      title="방을 정의하세요."
      description={
        <p>
          방 이름, 프로젝트 정보, 지원자 라벨을 입력합니다. 학생은 평가 ID와 학생
          입장 비밀번호로 접속하며, 두 값은 마지막 단계에서 함께 공유됩니다.
        </p>
      }
      actions={
        <Button
          type="submit"
          form="wizard-step-1-form"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "방을 만드는 중…" : "다음 단계"}
        </Button>
      }
    >
      <Form {...form}>
        <form
          id="wizard-step-1-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="room_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>방 / 시험 이름</FormLabel>
                <FormControl>
                  <Input placeholder="예: 캡스톤 4조 프로젝트 검증" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="project_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>프로젝트명</FormLabel>
                <FormControl>
                  <Input placeholder="예: 프로젝트 수행 진위 평가 서비스" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="candidate_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>지원자 / 팀 라벨</FormLabel>
                <FormControl>
                  <Input placeholder="예: 4조" {...field} />
                </FormControl>
                <FormDescription>
                  리포트와 관리 콘솔에서 이 라벨로 평가를 구분합니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>프로젝트 설명</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="핵심 기능과 제출 자료 범위를 간단히 적어주세요."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="room_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>학생 입장 비밀번호</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>4자 이상. 학생에게 안내합니다.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </WizardShell>
  );
}

// =====================================================================
// Stage 2 — ZIP 업로드 / 분석
// =====================================================================

export function Stage2Upload() {
  const { evaluationId, markStepCompleted, goToStep } = useWizardState();

  if (!evaluationId) {
    return (
      <WizardShell
        step={2}
        title="자료를 받아 분석합니다."
        description={<p>방 생성을 먼저 완료해야 합니다.</p>}
      >
        <p className="rounded-md border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
          1단계에서 방 정보를 입력해 주세요.
        </p>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      step={2}
      title="자료를 받아 분석합니다."
      description={
        <>
          <p>
            zip 한 개로 코드와 문서를 함께 제출받습니다. 파일을 선택하면 자동으로
            업로드·분류·분석이 시작됩니다.
          </p>
          <p className="mt-3 text-sm">
            지원 확장자는 zip 내부에서 자동 인식합니다. 최대 50MB / 500개 파일까지
            받습니다.
          </p>
        </>
      }
      actions={
        <Button
          type="button"
          variant="ghost"
          onClick={() => goToStep(1)}
        >
          ← 이전
        </Button>
      }
    >
      <ZipUploadPipeline
        evaluationId={evaluationId}
        onAnalyzed={() => markStepCompleted(2)}
      />
    </WizardShell>
  );
}

// =====================================================================
// Stage 3 — 질문 정책
// =====================================================================

const TOTAL_MIN = 1;
const TOTAL_MAX = 20;
const RATIO_MIN = 0;
const RATIO_MAX = 10;

export function Stage3Policy() {
  const {
    evaluationId,
    policyDraft,
    setPolicyDraft,
    markStepCompleted,
    goToStep,
  } = useWizardState();
  const evaluationQuery = useEvaluation(evaluationId);
  const mutation = useUpdateQuestionPolicy(evaluationId ?? "");

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
  const ratioSum = BLOOM_LEVELS.reduce(
    (sum, level) => sum + (ratios[level] ?? 0),
    0,
  );

  function updateRatio(level: BloomLevel, value: number) {
    setRatios((prev) => ({ ...prev, [level]: value }));
  }

  async function onSubmit() {
    if (ratioSum === 0) {
      toast.error("Bloom 단계 비율 합이 0 입니다. 최소 한 단계 이상 1 이상으로 두세요.");
      return;
    }
    if (!evaluationId) {
      toast.error("평가 ID가 비어 있습니다. 1단계로 돌아가세요.");
      return;
    }
    const payload = { total_question_count: total, bloom_ratios: ratios };
    setPolicyDraft(payload);
    try {
      await mutation.mutateAsync({ question_policy: payload });
      toast.success("질문 정책을 저장했습니다.");
      markStepCompleted(3);
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
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => goToStep(2)}>
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
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
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
            현재 비율 합 <span className="text-foreground">{ratioSum}</span> ·{" "}
            예정 문항 수 합{" "}
            <span className="text-foreground">
              {BLOOM_LEVELS.reduce((sum, level) => sum + distribution[level], 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </WizardShell>
  );
}

// =====================================================================
// Stage 4 — 질문 생성 & 검토
// =====================================================================

export function Stage4Questions() {
  const { evaluationId, markStepCompleted, goToStep } = useWizardState();
  const [hasAttemptedGeneration, setHasAttemptedGeneration] = useState(false);

  const statusQuery = useEvaluationStatus(evaluationId, {
    enabled: Boolean(evaluationId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (data.questions_ready) return false;
      return 2000;
    },
  });
  const questionsQuery = useAdminQuestions(evaluationId, {
    enabled: Boolean(evaluationId),
  });
  const generateMutation = useGenerateQuestions(evaluationId ?? "");

  const status = statusQuery.data;
  const questions = questionsQuery.data ?? [];
  const canGenerate = Boolean(status?.can_generate_questions);
  const hasQuestions = questions.length > 0;

  // #5: 질문 생성 시도 이전에는 차단 사유를 노출하지 않는다.
  const showBlockedReason = Boolean(
    status?.blocked_reason && (hasAttemptedGeneration || hasQuestions),
  );

  async function onGenerate() {
    setHasAttemptedGeneration(true);
    try {
      await generateMutation.mutateAsync();
      toast.success("자료 근거 기반으로 질문을 생성했습니다.");
    } catch (error) {
      toast.error(describeError(error, "질문 생성에 실패했습니다."));
    }
  }

  function onNext() {
    if (!hasQuestions) {
      toast.error("질문이 1개 이상 저장된 후에 다음 단계로 갈 수 있습니다.");
      return;
    }
    markStepCompleted(4);
  }

  return (
    <WizardShell
      step={4}
      title="질문을 미리 확인합니다."
      description={
        <>
          <p>
            앞서 정의한 정책으로 자료 근거 기반 질문을 생성합니다. 각 질문은 의도와
            검증 초점, 평가 포인트, 근거 출처를 함께 갖고 있습니다.
          </p>
          <p className="mt-3 text-sm">
            정책을 다시 바꾸고 싶다면 이전 단계로 돌아가세요. 재생성은 정책 변경 후
            다시 실행됩니다.
          </p>
        </>
      }
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => goToStep(3)}>
            ← 이전
          </Button>
          <Button type="button" onClick={onNext} disabled={!hasQuestions}>
            다음 단계
          </Button>
        </>
      }
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {status ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">phase · {status.phase || "-"}</Badge>
                <Badge variant="outline">status · {status.status || "-"}</Badge>
                <Badge variant="outline">
                  질문 {status.question_count} / {status.expected_question_count}
                </Badge>
                {status.has_context ? (
                  <Badge variant="secondary">context 준비</Badge>
                ) : (
                  <Badge variant="outline">context 미준비</Badge>
                )}
              </div>
              {status.user_message && (
                <p className="text-muted-foreground">{status.user_message}</p>
              )}
              {showBlockedReason && (
                <p className="text-destructive">차단 사유: {status.blocked_reason}</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">상태를 불러오는 중…</p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "질문 생성 중…"
                : hasQuestions
                  ? "질문 재생성"
                  : "질문 생성"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                statusQuery.refetch();
                questionsQuery.refetch();
              }}
            >
              상태 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {questions.length > 0 ? (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            생성된 질문 ({questions.length})
          </h3>
          <ol className="space-y-3">
            {questions.map((question, index) => (
              <li key={question.id}>
                <QuestionCard index={index + 1} question={question} />
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          아직 생성된 질문이 없습니다. context 분석이 끝나면 위에서 질문을 생성하세요.
        </p>
      )}
    </WizardShell>
  );
}

function QuestionCard({
  index,
  question,
}: {
  index: number;
  question: InterviewQuestionRead;
}) {
  const targets = question.evaluation_targets ?? [];
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">Q{index}</span>
          <Badge variant="secondary">{question.bloom_level}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
        </div>
        <CardTitle className="text-base leading-snug">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {targets.length > 0 && (
          <div>
            <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              이 질문이 확인하려는 점
            </div>
            <div className="flex flex-wrap gap-2">
              {targets.map((target) => (
                <Badge key={target} variant="outline">
                  {target}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {question.intent && <DetailRow label="의도" value={question.intent} />}
        {question.verification_focus && (
          <DetailRow label="검증 초점" value={question.verification_focus} />
        )}
        {question.expected_signal && (
          <DetailRow label="기대 신호" value={question.expected_signal} />
        )}
        {question.expected_evidence && (
          <DetailRow label="필요 근거" value={question.expected_evidence} />
        )}
        {question.source_refs && question.source_refs.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                근거 출처
              </div>
              <ul className="space-y-1">
                {question.source_refs.map((ref, refIndex) => {
                  const lineRange =
                    ref.line_start != null
                      ? `:${ref.line_start}${ref.line_end != null ? `-${ref.line_end}` : ""}`
                      : "";
                  const slide = ref.page_or_slide ? ` · ${ref.page_or_slide}` : "";
                  const role = ref.artifact_role ? `[${ref.artifact_role}] ` : "";
                  return (
                    <li
                      key={`${ref.path}-${refIndex}`}
                      className="font-mono text-xs text-muted-foreground"
                    >
                      {role}
                      {ref.path}
                      {lineRange}
                      {slide}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <p className="leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

// =====================================================================
// Stage 5 — 학생 공유 요약
// =====================================================================

function subscribeNoop(): () => void {
  return () => {};
}

export function Stage5Summary() {
  const router = useRouter();
  const { evaluationId, info, goToStep } = useWizardState();
  const evaluationQuery = useEvaluation(evaluationId);
  const questionsQuery = useAdminQuestions(evaluationId);

  const origin = useSyncExternalStore(
    subscribeNoop,
    () => (typeof window === "undefined" ? "" : window.location.origin),
    () => "",
  );

  const studentUrl = useMemo(() => {
    if (!evaluationId) return "";
    const base = origin || "";
    return `${base}/interview/${evaluationId}/join`;
  }, [evaluationId, origin]);

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
      actions={
        <>
          <Button type="button" variant="ghost" onClick={() => goToStep(4)}>
            ← 이전
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
            value={evaluationId ?? ""}
            onCopy={() => copy(evaluationId ?? "", "평가 ID")}
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
          <SummaryRow
            label="방 이름"
            value={evaluation?.room_name || info?.room_name}
          />
          <SummaryRow
            label="프로젝트"
            value={evaluation?.project_name || info?.project_name}
          />
          <SummaryRow
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
          <SummaryRow
            label="생성된 질문 수"
            value={String(questions.length)}
          />
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

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-foreground">{value || "-"}</span>
    </div>
  );
}

// 사용하지 않는 stage 가 unmount 될 때 일부 부수효과(예: 마법사 5단계 진입 시 highestCompletedStep
// 을 5로 끌어올리기)를 처리한다. 현재는 별도로 필요하지 않다.
export function useStageVisible(_visible: boolean) {
  useEffect(() => {
    // placeholder for future hook usage.
  }, [_visible]);
}
