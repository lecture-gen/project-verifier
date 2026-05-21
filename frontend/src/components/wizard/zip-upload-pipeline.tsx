"use client";

// ZIP 업로드 자동화 + 3단계 진행 카드.
// 파일을 선택하는 즉시 업로드 → 분류 → 분석 파이프라인을 자동 실행한다.
// 각 단계는 pending/running/done/failed 상태를 가지며, 실패하면 화면에서 사라지지 않고
// 카드에 사유를 그대로 노출한다. silent fallback 금지.

import { CheckCircle2, FileWarning, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useExtractContext, useUploadZipArtifact } from "@/lib/api/mutations";
import { useArtifacts, useExtractedContext } from "@/lib/api/queries";
import type {
  ArtifactUploadResult,
  ExtractedProjectContextRead,
} from "@/lib/api/endpoints";
import { AreasGrid } from "@/components/wizard/context/AreasGrid";
import { ArchitectureCanvas } from "@/components/wizard/context/ArchitectureCanvas";
import { FileTreeView } from "@/components/wizard/context/FileTreeView";
import { StructuralFactsPanel } from "@/components/wizard/context/StructuralFactsPanel";
import { StudentRisksCards } from "@/components/wizard/context/StudentRisksCards";
import { TechStackTable } from "@/components/wizard/context/TechStackTable";
import { GithubUrlImport } from "@/components/wizard/github-url-import";
import { QualityAssessmentCard } from "@/components/wizard/quality-assessment-card";
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
  // 이전 step 에서 이미 자료 등록이 완료된 상태로 다시 들어왔을 때 입력을 차단한다.
  readOnly?: boolean;
}

export function ZipUploadPipeline({
  evaluationId,
  onAnalyzed,
  readOnly = false,
}: ZipUploadPipelineProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  // 한 번 사용자가 직접 파일을 선택한 이후로는 server-state sync 가 stage 를 덮어쓰지 않도록 가드.
  const userInteractedRef = useRef(false);
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
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const uploadMutation = useUploadZipArtifact(evaluationId);
  const extractMutation = useExtractContext(evaluationId);
  // evaluationId 만으로 server-side 상태를 항상 조회한다. 다른 step 으로 갔다가
  // 돌아왔을 때 자료/분석 결과를 복원하기 위함.
  const artifactsQuery = useArtifacts(evaluationId, {
    enabled: Boolean(evaluationId),
  });
  const contextQuery = useExtractedContext(evaluationId, {
    enabled: Boolean(evaluationId),
    retry: false,
  });

  const artifacts = artifactsQuery.data ?? [];
  const context: ExtractedProjectContextRead | undefined =
    extractMutation.data ?? contextQuery.data;

  // server-side 상태 → stage 복원. 사용자가 새 업로드를 시작한 후에는 건드리지 않는다.
  useEffect(() => {
    if (userInteractedRef.current) return;
    if (artifacts.length > 0) {
      setUploadStage((prev) =>
        prev.status === "pending" ? { status: "done" } : prev,
      );
      setClassifyStage((prev) =>
        prev.status === "pending" ? { status: "done" } : prev,
      );
    }
  }, [artifacts.length]);

  useEffect(() => {
    if (userInteractedRef.current) return;
    if (context) {
      setAnalyzeStage((prev) =>
        prev.status === "pending" ? { status: "done" } : prev,
      );
      onAnalyzed?.();
    }
  }, [context, onAnalyzed]);

  async function runPipeline(file: File) {
    userInteractedRef.current = true;
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
    await runAnalysis();
  }

  async function runAnalysis() {
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

  async function handleGithubImported(result: ArtifactUploadResult) {
    userInteractedRef.current = true;
    setSelectedFile(null);
    setUploadResult(result);
    setUploadStage({ status: "done" });
    setClassifyStage({ status: "done" });
    await runAnalysis();
  }

  function pickFile(file: File | null) {
    if (readOnly) {
      // 이전 step 에서 이미 자료가 등록된 상태에서는 새 업로드를 받지 않는다.
      toast.error("이전 단계에서 등록한 자료를 사용 중이라 새 zip 을 업로드할 수 없습니다.");
      return;
    }
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

  const structuralFileTree = context?.structural_facts?.file_tree ?? [];
  const hasFileTree = structuralFileTree.length > 0;

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          zip 자료 업로드
        </h3>
        {readOnly ? (
          <p className="rounded-md border border-dashed border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            이전 단계에서 등록한 자료를 그대로 사용합니다.
            {artifacts.length > 0 && (
              <span className="ml-1 font-medium text-foreground">
                총 {artifacts.length}건
              </span>
            )}
            자료를 바꾸려면 새 평가를 만들어야 합니다.
          </p>
        ) : (
          <>
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
                    userInteractedRef.current = false;
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
          </>
        )}
      </section>

      {!readOnly && (
        <GithubUrlImport
          evaluationId={evaluationId}
          disabled={busy}
          onImported={handleGithubImported}
        />
      )}

      {/* 파일 트리는 분석이 끝나는 즉시 최상위에서 보여준다. (요구사항 2.3) */}
      {hasFileTree && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">파일 트리</CardTitle>
            <p className="text-sm text-muted-foreground">
              업로드한 자료의 디렉터리 구조입니다.
            </p>
          </CardHeader>
          <CardContent>
            <FileTreeView tree={structuralFileTree} />
          </CardContent>
        </Card>
      )}

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
        {uploadStage.status === "done" && !selectedFile && uploadResult && (
          <p className="text-xs text-muted-foreground">
            GitHub 저장소로부터 자료를 수신했습니다.
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
        {context ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAnalysisOpen((value) => !value)}
            >
              {analysisOpen ? "분석 결과 접기" : "분석 결과 자세히 보기"}
            </Button>
            {analysisOpen && <ContextSummary context={context} />}
          </div>
        ) : (
          <AnalyzeSkeleton />
        )}
      </PipelineStageCard>

      <QualityAssessmentCard
        evaluationId={evaluationId}
        contextReady={Boolean(context)}
      />
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
    <div className="space-y-6">
      {context.summary && (
        <Section title="프로젝트 요약">
          <p className="whitespace-pre-wrap leading-relaxed">{context.summary}</p>
        </Section>
      )}

      <Section title="기술 스택">
        <TechStackTable items={context.tech_stack ?? []} />
      </Section>

      <Section title="아키텍처">
        <ArchitectureCanvas architecture={context.architecture} />
      </Section>

      <Section title="주요 기능">
        <FeaturesList items={context.features ?? []} />
      </Section>

      <Section title="프로젝트 영역">
        <AreasGrid areas={context.areas ?? []} />
      </Section>

      <Section title="학생이 부딪혔을 만한 구현 난점">
        <StudentRisksCards risks={context.student_implementation_risks ?? []} />
      </Section>

      <Section title="구조 통계">
        <StructuralFactsPanel facts={context.structural_facts} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  small = false,
}: {
  title: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <section>
      <h4
        className={cn(
          "mb-2 uppercase tracking-[0.18em] text-muted-foreground",
          small ? "text-[10px]" : "text-xs",
        )}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

function FeaturesList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
        식별된 사용자 시각의 제품 기능이 없습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-sm">
          <span className="text-muted-foreground">·</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
