"use client";

// 평가별 admin password 확인 모달.
// 입력 → verifyAdmin API 호출 → 성공 시 sessionStorage 에 저장 + onVerified 콜백 + 모달 닫힘.
// CLAUDE.md 정책: 실패는 silent fallback 없이 명확한 에러 메시지 노출.

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useVerifyAdmin } from "@/lib/api/mutations";
import { writeAdminPassword } from "@/lib/session/admin";

export interface AdminPasswordDialogProps {
  evaluationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: (password: string) => void;
  // 모달에 노출할 평가 라벨 (방 이름 등).
  evaluationLabel?: string;
}

export function AdminPasswordDialog({
  evaluationId,
  open,
  onOpenChange,
  onVerified,
  evaluationLabel,
}: AdminPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const mutation = useVerifyAdmin(evaluationId);

  function handleOpenChange(next: boolean) {
    if (!next) setPassword("");
    onOpenChange(next);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      toast.error("평가자 비밀번호를 입력하세요.");
      return;
    }
    try {
      const result = await mutation.mutateAsync({ admin_password: password });
      if (!result.ok) {
        toast.error("평가자 비밀번호가 올바르지 않습니다.");
        return;
      }
      writeAdminPassword(evaluationId, password);
      toast.success("평가자 인증 완료.");
      setPassword("");
      onOpenChange(false);
      onVerified(password);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "비밀번호 확인 중 오류가 발생했습니다.";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>평가자 인증</DialogTitle>
            <DialogDescription>
              {evaluationLabel ? `“${evaluationLabel}” ` : ""}관리 콘솔에 진입하려면
              평가자 비밀번호가 필요합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="admin-password">평가자 비밀번호</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="off"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={mutation.isPending}
            />
            <p className="font-mono text-xs text-muted-foreground">
              평가 ID · {evaluationId}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "확인 중…" : "인증"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
