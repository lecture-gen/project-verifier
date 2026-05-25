"use client";

// 단일 페이지 마법사의 5개 stage 본문. 각 stage 는 자기 폼/콘텐츠만 렌더하고,
// 우측 하단 [다음 →] 버튼은 wizard state 의 setAdvance(...) 로 등록한 핸들러가 처리한다.
// 외곽 셸(좌측 rail, 제목, nav)은 WizardShell + page 가 책임진다.

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { z } from "zod";

import { ZipUploadPipeline } from "@/components/wizard/zip-upload-pipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
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
  BLOOM_PRESETS,
  BLOOM_PRESET_OPTIONS,
  calculateBloomDistribution,
  defaultBloomRatios,
  findMatchingPreset,
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

const PROJECT_CATEGORY_OPTIONS = [
  { value: "weekly", label: "주간 과제" },
  { value: "midterm", label: "중간 과제" },
  { value: "final", label: "기말 과제" },
  { value: "capstone_final", label: "최종 과제" },
] as const;

const infoSchema = z
  .object({
    name: z.string().trim().min(1, "평가 명을 입력하세요."),
    evaluation_period_start: z.string(),
    evaluation_period_end: z.string(),
    expected_participant_count: z
      .number()
      .int("정수만 입력해 주세요.")
      .min(1, "1명 이상으로 입력해 주세요.")
      .max(500, "500명 이하로 입력해 주세요.")
      .nullable(),
    project_category: z.enum(["weekly", "midterm", "final", "capstone_final"]),
    focus_points: z
      .string()
      .max(2000, "중점사항은 2000자 이하로 작성해 주세요."),
  })
  .refine(
    (value) => {
      if (!value.evaluation_period_start || !value.evaluation_period_end) {
        return true;
      }
      return value.evaluation_period_start <= value.evaluation_period_end;
    },
    {
      path: ["evaluation_period_end"],
      message: "종료일은 시작일과 같거나 이후여야 합니다.",
    },
  );

type InfoFormValues = z.infer<typeof infoSchema>;

function ymdInKst(date: Date): string {
  // Date 객체 → "YYYY-MM-DD" (Asia/Seoul 기준).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function ymdToIso(ymd: string): string | null {
  if (!ymd) return null;
  // "YYYY-MM-DD" 를 KST 자정으로 해석해 UTC ISO 로 변환.
  const parsed = new Date(`${ymd}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function ymdToDate(ymd: string): Date | undefined {
  if (!ymd) return undefined;
  // Calendar 가 비교하는 Date 는 로컬 자정이면 충분.
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatKstYmdDisplay(ymd: string): string {
  // 화면 표시용. "2026.05.25" 처럼 점 구분.
  const date = ymdToDate(ymd);
  if (!date) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\.\s*$/, "");
}

export function Stage1Info() {
  const { info, setEvaluation, setAdvance, markStepCompleted, isStepReadonly } =
    useWizardState();
  const mutation = useCreateEvaluation();
  const readonly = isStepReadonly(1);

  const form = useForm<InfoFormValues>({
    resolver: zodResolver(infoSchema),
    defaultValues: {
      name: info?.name ?? "",
      evaluation_period_start: "",
      evaluation_period_end: "",
      expected_participant_count: null,
      project_category: info?.project_category ?? "weekly",
      focus_points: info?.focus_points ?? "",
    },
  });

  async function onSubmit(values: InfoFormValues) {
    try {
      const created = await mutation.mutateAsync({
        name: values.name,
        evaluation_period_start: ymdToIso(values.evaluation_period_start ?? ""),
        evaluation_period_end: ymdToIso(values.evaluation_period_end ?? ""),
        expected_participant_count: values.expected_participant_count,
        project_category: values.project_category,
        focus_points: values.focus_points ?? "",
      });
      setEvaluation(created.id, {
        name: created.name,
        project_category: created.project_category,
        focus_points: created.focus_points ?? "",
      });
      toast.success(`평가를 만들었습니다.`);
    } catch (error) {
      toast.error(describeError(error, "평가 생성에 실패했습니다."));
    }
  }

  // 우측 하단 [다음 →] 가 폼 submit 을 트리거하도록 advance 등록.
  // RHF 의 handleSubmit 은 validation 실패 시 자동으로 폼 에러를 노출한다.
  // readonly 면 mutation 우회하고 단순 이동만.
  useEffect(() => {
    setAdvance({
      onAdvance: readonly
        ? () => markStepCompleted(1)
        : form.handleSubmit(onSubmit),
      canAdvance: readonly || !mutation.isPending,
      busy: !readonly && mutation.isPending,
      label: "다음 단계",
    });
    return () => setAdvance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutation.isPending, setAdvance, readonly, markStepCompleted]);

  return (
    <WizardShell step={1}>
      <Form {...form}>
        <form
          id="wizard-step-1-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>평가 명</FormLabel>
                <FormControl>
                  <Input
                    placeholder="예: 캡스톤 4조 프로젝트 수행 진위 검증"
                    disabled={readonly}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  하나의 평가를 만들면 여러 학생이 같은 입장 URL로 들어와 각자
                  검증을 받습니다. 리포트는 학생별로 나뉘어 확인할 수 있습니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="evaluation_period_start"
            render={({ field }) => (
              <FormItem>
                <FormLabel>프로젝트 기간</FormLabel>
                <FormControl>
                  <ProjectPeriodPicker
                    startYmd={field.value ?? ""}
                    endYmd={form.watch("evaluation_period_end") ?? ""}
                    disabled={readonly}
                    onChange={(start, end) => {
                      field.onChange(start);
                      form.setValue("evaluation_period_end", end, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                    }}
                  />
                </FormControl>
                <FormDescription>
                  달력에서 시작일과 종료일을 차례로 선택합니다. 같은 날짜를 두 번
                  누르면 하루짜리 기간이 됩니다.
                </FormDescription>
                <FormMessage />
                {form.formState.errors.evaluation_period_end && (
                  <p className="text-sm font-medium text-destructive">
                    {form.formState.errors.evaluation_period_end.message as string}
                  </p>
                )}
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="expected_participant_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>예상 학생 수</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      placeholder="예: 4"
                      disabled={readonly}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        field.onChange(raw === "" ? null : Number(raw));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    이 프로젝트를 함께 수행한 인원. 품질 평가의 baseline 으로 사용됩니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="project_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>프로젝트 분류</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={readonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="프로젝트 분류를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    3단계 비율 프리셋이 이 분류를 따라 자동으로 적용됩니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="focus_points"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이 평가에서 중요시할 점</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="예: RAG 인덱싱 설계와 검색 품질을 핵심으로 봅니다. 단순한 CRUD 구현보다 의사결정 근거를 우선합니다."
                    disabled={readonly}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormDescription>
                  프로젝트 품질 평가와 질문 생성 시 가중치 키워드로 사용됩니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {readonly && (
            <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              평가가 이미 생성되어 이 단계의 정보는 변경할 수 없습니다.
            </p>
          )}
        </form>
      </Form>
    </WizardShell>
  );
}

function ProjectPeriodPicker({
  startYmd,
  endYmd,
  disabled,
  onChange,
}: {
  startYmd: string;
  endYmd: string;
  disabled?: boolean;
  onChange: (startYmd: string, endYmd: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const clickCount = useRef(0);

  useEffect(() => {
    if (open) clickCount.current = 0;
  }, [open]);

  const selected: DateRange | undefined =
    startYmd || endYmd
      ? { from: ymdToDate(startYmd), to: ymdToDate(endYmd) }
      : undefined;

  const label = (() => {
    if (!startYmd && !endYmd) return "프로젝트 기간을 선택하세요";
    if (startYmd && endYmd) {
      return `${formatKstYmdDisplay(startYmd)} ~ ${formatKstYmdDisplay(endYmd)}`;
    }
    if (startYmd) return `${formatKstYmdDisplay(startYmd)} ~ (종료일 선택)`;
    return `(시작일 선택) ~ ${formatKstYmdDisplay(endYmd)}`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          <span className={startYmd || endYmd ? "" : "text-muted-foreground"}>
            {label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={(range) => {
            const next = range as DateRange | undefined;
            const from = next?.from ? ymdInKst(next.from) : "";
            const to = next?.to ? ymdInKst(next.to) : "";
            onChange(from, to);
            clickCount.current += 1;
            if (clickCount.current >= 2) {
              setOpen(false);
            }
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// =====================================================================
// Stage 2 — ZIP 업로드 / 분석
// =====================================================================

export function Stage2Upload() {
  const { evaluationId, markStepCompleted, setAdvance, isStepReadonly } =
    useWizardState();
  const readonly = isStepReadonly(2);
  // 분석이 끝났는지 여부. 사용자가 이번 세션에서 새로 분석을 마쳤거나(setAnalyzed),
  // 이전에 등록한 자료가 서버에 남아 있어 status.has_context = true 인 경우 모두 true 로 본다.
  const [analyzed, setAnalyzed] = useState(false);
  const statusQuery = useEvaluationStatus(evaluationId, {
    enabled: Boolean(evaluationId),
  });
  const serverAnalyzed = Boolean(statusQuery.data?.has_context);
  const canAdvance = analyzed || serverAnalyzed;

  useEffect(() => {
    setAdvance({
      onAdvance: () => {
        if (!canAdvance) return;
        markStepCompleted(2);
      },
      canAdvance,
      label: "다음 단계",
    });
    return () => setAdvance(null);
  }, [canAdvance, markStepCompleted, setAdvance]);

  if (!evaluationId) {
    return (
      <WizardShell step={2}>
        <p className="rounded-md border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
          1단계에서 방 정보를 입력해 주세요.
        </p>
      </WizardShell>
    );
  }

  return (
    <WizardShell step={2}>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          zip 한 개로 코드와 문서를 함께 제출받습니다. 파일을 선택하면 자동으로
          업로드·분류·분석이 시작됩니다.
        </p>
        <p>
          지원 확장자는 zip 내부에서 자동 인식합니다. 최대 50MB / 500개 파일까지
          받습니다.
        </p>
        <p>
          분석이 끝나면 결과를 확인하고 우측 하단 <strong>[다음 단계]</strong> 를
          눌러 진행하세요.
        </p>
      </div>
      <ZipUploadPipeline
        evaluationId={evaluationId}
        onAnalyzed={() => setAnalyzed(true)}
        readOnly={readonly}
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
    info,
    policyDraft,
    setPolicyDraft,
    markStepCompleted,
    setAdvance,
    isStepReadonly,
  } = useWizardState();
  const readonly = isStepReadonly(3);
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
    const presetKey = info?.project_category ?? "weekly";
    const preset = BLOOM_PRESETS[presetKey];
    return {
      total_question_count: preset.total,
      bloom_ratios: { ...preset.ratios },
    };
  }, [evaluationQuery.data, policyDraft, info?.project_category]);

  const [total, setTotal] = useState<number>(initial.total_question_count);
  const [ratios, setRatios] = useState<Record<string, number>>(initial.bloom_ratios);
  const matchedPreset = useMemo(
    () => findMatchingPreset(total, ratios),
    [total, ratios],
  );

  function applyPreset(key: "weekly" | "midterm" | "final" | "capstone_final") {
    const preset = BLOOM_PRESETS[key];
    setTotal(preset.total);
    setRatios({ ...preset.ratios });
  }

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

  useEffect(() => {
    setAdvance({
      onAdvance: readonly ? () => markStepCompleted(3) : onSubmit,
      canAdvance:
        readonly ||
        (ratioSum > 0 && !mutation.isPending && Boolean(evaluationId)),
      busy: !readonly && mutation.isPending,
      label: "다음 단계",
    });
    return () => setAdvance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ratioSum,
    mutation.isPending,
    evaluationId,
    total,
    ratios,
    setAdvance,
    readonly,
    markStepCompleted,
  ]);

  return (
    <WizardShell step={3}>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          총 문항 수와 Bloom 단계별 비율로 질문 분포를 정의합니다. 비율 합이 0이면
          저장할 수 없습니다.
        </p>
        <p>동률 잔여 문항은 기억 → 이해 → 적용 → 분석 → 평가 → 창안 순으로 배정됩니다.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">프리셋</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Select
              value={matchedPreset ?? "custom"}
              onValueChange={(value) => {
                if (value !== "custom") {
                  applyPreset(
                    value as "weekly" | "midterm" | "final" | "capstone_final",
                  );
                }
              }}
              disabled={readonly}
            >
              <SelectTrigger className="sm:max-w-xs">
                <SelectValue placeholder="프리셋 선택" />
              </SelectTrigger>
              <SelectContent>
                {BLOOM_PRESET_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom" disabled>
                  커스텀 (슬라이더 수동 조정)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              1단계에서 선택한 분류가 기본 프리셋으로 적용됩니다. 슬라이더로 값을
              조정하면 자동으로 &quot;커스텀&quot; 으로 표시됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

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
            disabled={readonly}
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
                  disabled={readonly}
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
  const { evaluationId, markStepCompleted, setAdvance, isStepReadonly } =
    useWizardState();
  const readonly = isStepReadonly(4);

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

  async function onGenerate() {
    if (!canGenerate) {
      const reason = status?.blocked_reason;
      toast.error(
        reason
          ? `문항을 생성할 수 없습니다: ${reason}`
          : "문항을 생성할 수 없습니다. 이전 단계가 완료되었는지 확인해주세요.",
      );
      return;
    }
    try {
      await generateMutation.mutateAsync();
      toast.success("자료 근거 기반으로 문항을 생성했습니다.");
    } catch (error) {
      toast.error(describeError(error, "문항 생성에 실패했습니다."));
    }
  }

  useEffect(() => {
    setAdvance({
      onAdvance: () => {
        if (!hasQuestions) {
          toast.error("문항이 1개 이상 저장된 후에 다음 단계로 갈 수 있습니다.");
          return;
        }
        markStepCompleted(4);
      },
      canAdvance: hasQuestions && !generateMutation.isPending,
      busy: generateMutation.isPending,
      label: "다음 단계",
    });
    return () => setAdvance(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuestions, generateMutation.isPending, setAdvance]);

  const showGenerateButton = !readonly && !hasQuestions;

  return (
    <WizardShell step={4}>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          앞서 정의한 정책으로 자료 근거 기반 문항을 생성합니다. 각 문항은 출제 의도,
          기대 답안, 채점 기준표, 근거 출처를 함께 갖고 있습니다.
        </p>
      </div>

      {showGenerateButton && (
        <div>
          <Button
            type="button"
            size="lg"
            onClick={onGenerate}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? <Spinner /> : "문항 생성"}
          </Button>
        </div>
      )}

      {hasQuestions ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              생성된 문항 ({questions.length})
            </h3>
            <span className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">
              최종 리포트에서 점수는 100점으로 정규화됩니다.
            </span>
          </div>
          <ol className="space-y-3">
            {questions.map((question, index) => (
              <li key={question.id}>
                <QuestionCard index={index + 1} question={question} />
              </li>
            ))}
          </ol>
        </section>
      ) : readonly ? (
        <p className="rounded-md border border-dashed border-border/60 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          이전 단계에서 생성된 문항이 표시됩니다.
        </p>
      ) : null}
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
  const rubric = question.scoring_rubric ?? [];
  const rubricTotal = rubric.reduce((sum, item) => sum + (item.points ?? 0), 0);
  return (
    <Card>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-muted-foreground">Q{index}</span>
          <Badge variant="secondary">{question.bloom_level}</Badge>
          <Badge variant="default">{question.max_points}점 만점</Badge>
        </div>
        <CardTitle className="text-base leading-snug">{question.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {question.intent && <DetailRow label="출제 의도" value={question.intent} />}
        {question.expected_answer && (
          <DetailRow label="기대 답안" value={question.expected_answer} />
        )}
        {rubric.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>채점 기준표</span>
              <span className="font-mono normal-case tracking-normal">
                합계 {rubricTotal}점
              </span>
            </div>
            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {rubric.map((item, itemIndex) => (
                <li
                  key={`${item.description}-${itemIndex}`}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <span className="leading-relaxed text-foreground">
                    {item.description}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {item.points}점
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {question.source_refs && question.source_refs.length > 0 && (
          <details className="group rounded-md border border-border/60 px-3 py-2">
            <summary className="cursor-pointer select-none text-xs uppercase tracking-[0.16em] text-muted-foreground">
              근거 출처 ({question.source_refs.length})
            </summary>
            <ul className="mt-2 space-y-1">
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
          </details>
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
  const { evaluationId, setAdvance } = useWizardState();

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

  async function copy(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} 을(를) 복사했습니다.`);
    } catch {
      toast.error("클립보드 접근이 차단되었습니다. 직접 선택해 복사하세요.");
    }
  }

  useEffect(() => {
    setAdvance({
      onAdvance: () => {
        if (!evaluationId) return;
        router.push(`/admin/${evaluationId}`);
      },
      canAdvance: Boolean(evaluationId),
      label: "관리 콘솔로 이동 →",
    });
    return () => setAdvance(null);
  }, [evaluationId, router, setAdvance]);

  return (
    <WizardShell step={5}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">학생 공유 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <SharedField
            label="학생 입장 URL"
            value={studentUrl}
            onCopy={() => copy(studentUrl, "학생 입장 URL")}
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
