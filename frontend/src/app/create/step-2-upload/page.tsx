"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { ApiError } from "@/lib/api/client";
import {
  useExtractContext,
  useUploadZipArtifact,
} from "@/lib/api/mutations";
import { useExtractedContext } from "@/lib/api/queries";
import type {
  ArtifactUploadResult,
  ExtractedProjectContextRead,
} from "@/lib/api/endpoints";
import { useWizardGuard } from "@/lib/wizard/guard";
import { useWizardState } from "@/lib/wizard/state";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function WizardStep2Page() {
  const router = useRouter();
  const guard = useWizardGuard({ step: 2, minStepCompleted: 1 });
  const { markStepCompleted } = useWizardState();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<ArtifactUploadResult | null>(
    null,
  );

  const evaluationId = guard?.evaluationId ?? "";
  const adminPassword = guard?.adminPassword ?? "";

  const uploadMutation = useUploadZipArtifact(evaluationId, adminPassword);
  const extractMutation = useExtractContext(evaluationId, adminPassword);
  const contextQuery = useExtractedContext(evaluationId, adminPassword, {
    // 업로드 전에는 404 가 떨어지므로 disable. 업로드 결과가 있을 때만 fetch.
    enabled: Boolean(uploadResult || extractMutation.isSuccess),
    retry: false,
  });

  // 이미 업로드된 평가로 돌아온 경우 context query 가 성공하면 그것으로 UI 채움.
  const context: ExtractedProjectContextRead | undefined =
    extractMutation.data ?? contextQuery.data;

  // 평가가 이미 분석되어 있으면 자동으로 다음 단계 진행 허용.
  useEffect(() => {
    if (context) markStepCompleted(2);
  }, [context, markStepCompleted]);

  if (!guard) return null;

  function pickFile(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("zip 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`파일이 너무 큽니다. 최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
      return;
    }
    setSelectedFile(file);
  }

  async function onUpload() {
    if (!selectedFile) return;
    try {
      const result = await uploadMutation.mutateAsync({ file: selectedFile });
      setUploadResult(result);
      toast.success(
        `자료 ${result.accepted_count}건 분류 완료. 분석을 시작합니다.`,
      );
      await extractMutation.mutateAsync();
      toast.success("프로젝트 분석이 완료되었습니다.");
    } catch (error) {
      toast.error(describeError(error, "자료 업로드 또는 분석에 실패했습니다."));
    }
  }

  async function onReanalyze() {
    try {
      await extractMutation.mutateAsync();
      toast.success("프로젝트 분석을 다시 실행했습니다.");
    } catch (error) {
      toast.error(describeError(error, "재분석에 실패했습니다."));
    }
  }

  function onNext() {
    if (!context) {
      toast.error("프로젝트 분석이 완료된 후에 다음 단계로 갈 수 있습니다.");
      return;
    }
    markStepCompleted(2);
    router.push("/create/step-3-policy");
  }

  const uploading = uploadMutation.isPending || extractMutation.isPending;

  return (
    <WizardShell
      step={2}
      title="자료를 받아 분석합니다."
      description={
        <>
          <p>
            zip 한 개로 코드와 문서를 함께 제출받습니다. 업로드 직후 자료를 분류·요약해
            인터뷰 질문의 근거를 만들 컨텍스트를 생성합니다.
          </p>
          <p className="mt-3 text-sm">
            지원 확장자는 zip 내부에서 자동 인식합니다. 최대 50MB / 500개 파일까지
            받습니다.
          </p>
        </>
      }
      previousLabel="방 정보"
      nextLabel="질문 정책"
      actions={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/create/step-1-info")}
          >
            ← 이전
          </Button>
          <Button type="button" onClick={onNext} disabled={!context || uploading}>
            다음 단계
          </Button>
        </>
      }
    >
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          1. zip 업로드
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".zip,application/zip"
            disabled={uploading}
            onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            className="cursor-pointer"
          />
          <Button
            type="button"
            onClick={onUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? "업로드·분석 중…" : selectedFile ? "업로드" : "파일을 골라주세요"}
          </Button>
        </div>
        {selectedFile && !uploadResult && (
          <p className="text-sm text-muted-foreground">
            선택된 파일: <span className="font-mono">{selectedFile.name}</span> ·
            {" "}
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        )}
      </section>

      {uploadResult && <ArtifactBreakdown result={uploadResult} />}

      {context && (
        <ContextSummary
          context={context}
          onReanalyze={onReanalyze}
          reanalyzing={extractMutation.isPending}
        />
      )}
    </WizardShell>
  );
}

function ArtifactBreakdown({ result }: { result: ArtifactUploadResult }) {
  const reasons = Object.entries(result.reason_counts ?? {});
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">자료 분류 결과</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
          <div className="flex flex-wrap gap-2 pt-2">
            {reasons.map(([reason, count]) => (
              <Badge key={reason} variant="outline">
                {reason} · {count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function ContextSummary({
  context,
  onReanalyze,
  reanalyzing,
}: {
  context: ExtractedProjectContextRead;
  onReanalyze: () => void;
  reanalyzing: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">분석 요약</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            인터뷰 질문은 이 요약과 자료 근거를 함께 사용합니다.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReanalyze}
          disabled={reanalyzing}
        >
          {reanalyzing ? "분석 중…" : "다시 분석"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {context.summary && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {context.summary}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ContextList title="기술 스택" items={context.tech_stack ?? []} />
          <ContextList title="주요 기능" items={context.features ?? []} />
          <ContextList
            title="아키텍처 노트"
            items={context.architecture_notes ?? []}
          />
          <ContextList title="리스크 포인트" items={context.risk_points ?? []} />
        </div>
        {context.areas && context.areas.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              프로젝트 영역
            </h3>
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
      </CardContent>
    </Card>
  );
}

function ContextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
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
