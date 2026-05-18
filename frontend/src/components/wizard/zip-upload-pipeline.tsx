"use client";

// ZIP 업로드 자동화 + 3단계 진행 카드.
// 파일을 선택하는 즉시 업로드 → 분류 → 분석 파이프라인을 자동 실행한다.
// 각 단계는 pending/running/done/failed 상태를 가지며, 실패하면 화면에서 사라지지 않고
// 카드에 사유를 그대로 노출한다. silent fallback 금지.

import { CheckCircle2, FileWarning, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useExtractContext, useUploadZipArtifact } from "@/lib/api/mutations";
import { useExtractedContext } from "@/lib/api/queries";
import type {
  ArtifactUploadResult,
  ExtractedProjectContextRead,
} from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

type StageStatus = "pending" | "running" | "done" | "failed";

interface StageState {
  status: StageStatus;
  error?: string;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export interface ZipUploadPipelineProps {
  evaluationId: string;
  onAnalyzed?: () => void;
}

export function ZipUploadPipeline({
  evaluationId,
  onAnalyzed,
}: ZipUploadPipelineProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ArtifactUploadResult | null>(
    null,
  );
  const [uploadStage, setUploadStage] = useState<StageState>({ status: "pending" });
  const [classifyStage, setClassifyStage] = useState<StageState>({
    status: "pending",
  });
  const [analyzeStage, setAnalyzeStage] = useState<StageState>({
    status: "pending",
  });

  const uploadMutation = useUploadZipArtifact(evaluationId);
  const extractMutation = useExtractContext(evaluationId);
  const contextQuery = useExtractedContext(evaluationId, {
    enabled: Boolean(uploadResult || extractMutation.isSuccess),
    retry: false,
  });

  const context: ExtractedProjectContextRead | undefined =
    extractMutation.data ?? contextQuery.data;

  async function runPipeline(file: File) {
    setSelectedFile(file);
    setUploadResult(null);
    setUploadStage({ status: "running" });
    setClassifyStage({ status: "pending" });
    setAnalyzeStage({ status: "pending" });

    // ── 업로드 + 분류 ──
    let uploaded: ArtifactUploadResult;
    try {
      uploaded = await uploadMutation.mutateAsync({ file });
    } catch (error) {
      const message = describeError(error, "자료 업로드에 실패했습니다.");
      setUploadStage({ status: "failed", error: message });
      toast.error(message);
      return;
    }
    setUploadStage({ status: "done" });
    setUploadResult(uploaded);
    setClassifyStage({ status: "done" });

    // ── 분석 ──
    setAnalyzeStage({ status: "running" });
    try {
      await extractMutation.mutateAsync();
      setAnalyzeStage({ status: "done" });
      toast.success("프로젝트 분석이 완료되었습니다.");
      onAnalyzed?.();
    } catch (error) {
      const message = describeError(error, "프로젝트 분석에 실패했습니다.");
      setAnalyzeStage({ status: "failed", error: message });
      toast.error(message);
    }
  }

  function pickFile(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("zip 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`파일이 너무 큽니다. 최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
      return;
    }
    runPipeline(file);
  }

  const busy =
    uploadStage.status === "running" ||
    classifyStage.status === "running" ||
    analyzeStage.status === "running";

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          zip 자료 업로드
        </h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            disabled={busy}
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            className="cursor-pointer"
          />
          {selectedFile && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                setSelectedFile(null);
                setUploadResult(null);
                setUploadStage({ status: "pending" });
                setClassifyStage({ status: "pending" });
                setAnalyzeStage({ status: "pending" });
              }}
            >
              초기화
            </Button>
          )}
        </div>
        {selectedFile && (
          <p className="text-sm text-muted-foreground">
            선택된 파일: <span className="font-mono">{selectedFile.name}</span> ·{" "}
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </section>

      <PipelineStageCard
        title="1. 업로드"
        description="zip 파일을 서버로 전송합니다."
        stage={uploadStage}
      >
        {uploadStage.status === "done" && selectedFile && (
          <p className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB 전송 완료
          </p>
        )}
      </PipelineStageCard>

      <PipelineStageCard
        title="2. 자료 분류"
        description="zip 내부 코드/문서를 분류하고 텍스트를 추출합니다."
        stage={classifyStage}
      >
        {uploadResult ? (
          <ArtifactBreakdown result={uploadResult} />
        ) : (
          <ClassifySkeleton />
        )}
      </PipelineStageCard>

      <PipelineStageCard
        title="3. 프로젝트 분석"
        description="LLM 으로 프로젝트 요약·기술 스택·기능·아키텍처·리스크를 추출합니다."
        stage={analyzeStage}
      >
        {context ? <ContextSummary context={context} /> : <AnalyzeSkeleton />}
      </PipelineStageCard>
    </div>
  );
}

function PipelineStageCard({
  title,
  description,
  stage,
  children,
}: {
  title: string;
  description: string;
  stage: StageState;
  children?: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        stage.status === "failed" && "border-destructive/60",
        stage.status === "done" && "border-emerald-600/40",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <StageStatusBadge stage={stage} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {stage.status === "failed" && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            실패 사유: {stage.error ?? "(원인 미상)"}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function StageStatusBadge({ stage }: { stage: StageState }) {
  if (stage.status === "running") {
    return (
      <Badge variant="secondary" className="gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" /> 진행 중
      </Badge>
    );
  }
  if (stage.status === "done") {
    return (
      <Badge variant="outline" className="gap-1.5 border-emerald-600/40 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> 완료
      </Badge>
    );
  }
  if (stage.status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1.5">
        <FileWarning className="h-3 w-3" /> 실패
      </Badge>
    );
  }
  return <Badge variant="outline">대기</Badge>;
}

function ClassifySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function AnalyzeSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

function ArtifactBreakdown({ result }: { result: ArtifactUploadResult }) {
  const reasons = Object.entries(result.reason_counts ?? {});
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Metric label="분류 성공" value={result.accepted_count} tone="success" />
        <Metric label="건너뜀" value={result.skipped_count} />
        <Metric label="너무 큼" value={result.file_too_large_count} />
        <Metric
          label="실패"
          value={result.failed_count}
          tone={result.failed_count > 0 ? "danger" : "default"}
        />
      </div>
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {reasons.map(([reason, count]) => (
            <Badge key={reason} variant="outline">
              {reason} · {count}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-serif text-2xl ${toneClass}`}>{value}</div>
    </div>
  );
}

function ContextSummary({ context }: { context: ExtractedProjectContextRead }) {
  return (
    <div className="space-y-4">
      {context.summary && (
        <p className="whitespace-pre-wrap leading-relaxed">{context.summary}</p>
      )}
      {/* #4: 각 항목이 카드 전체 가로 폭을 차지하도록 단일 컬럼 grid */}
      <div className="grid grid-cols-1 gap-3">
        <ContextList title="기술 스택" items={context.tech_stack ?? []} />
        <ContextList title="주요 기능" items={context.features ?? []} />
        <ContextList title="아키텍처 노트" items={context.architecture_notes ?? []} />
        <ContextList title="리스크 포인트" items={context.risk_points ?? []} />
      </div>
      {context.areas && context.areas.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            프로젝트 영역
          </h4>
          <ul className="space-y-2">
            {context.areas.map((area) => (
              <li
                key={area.id}
                className="rounded border border-border/60 px-3 py-2 text-sm"
              >
                <span className="font-medium">{area.name}</span>
                {area.summary && (
                  <span className="text-muted-foreground"> — {area.summary}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded border border-border/60 p-3">
      <h4 className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-muted-foreground">·</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
