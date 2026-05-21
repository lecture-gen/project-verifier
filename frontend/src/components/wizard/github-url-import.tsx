"use client";

// GitHub URL 로 공개 저장소를 zip 으로 가져온다.
// 성공 시 외부에서 받은 onImported 콜백으로 zip 업로드 파이프라인의 후속 단계를 이어가도록 위임한다.
// 실패는 silent fallback 없이 카드 안에 사유를 그대로 노출한다.

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { useImportGithubRepoArtifact } from "@/lib/api/mutations";
import type { ArtifactUploadResult } from "@/lib/api/endpoints";

export interface GithubUrlImportProps {
  evaluationId: string;
  disabled?: boolean;
  onImported: (result: ArtifactUploadResult) => void;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function GithubUrlImport({
  evaluationId,
  disabled = false,
  onImported,
}: GithubUrlImportProps) {
  const [url, setUrl] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const mutation = useImportGithubRepoArtifact(evaluationId);

  async function onImport() {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error("GitHub 저장소 URL 을 입력하세요.");
      return;
    }
    setLastError(null);
    try {
      const result = await mutation.mutateAsync({ githubUrl: trimmed });
      onImported(result);
      toast.success("GitHub 저장소를 가져왔습니다. 분석을 시작합니다.");
    } catch (error) {
      const message = describeError(error, "GitHub 저장소 가져오기에 실패했습니다.");
      setLastError(message);
      toast.error(message);
    }
  }

  const busy = mutation.isPending;
  const inputDisabled = busy || disabled;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">GitHub 저장소로 가져오기</CardTitle>
        <p className="text-sm text-muted-foreground">
          public 저장소의 기본 브랜치를 zip 으로 받아 분석합니다. private 저장소는
          지원하지 않습니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="url"
            placeholder="https://github.com/{owner}/{repo}"
            value={url}
            disabled={inputDisabled}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!inputDisabled) {
                  void onImport();
                }
              }
            }}
          />
          <Button
            type="button"
            onClick={onImport}
            disabled={inputDisabled}
            className="shrink-0"
          >
            {busy ? <Spinner /> : "가져오기"}
          </Button>
        </div>
        {lastError && (
          <div className="rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            실패 사유: {lastError}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
