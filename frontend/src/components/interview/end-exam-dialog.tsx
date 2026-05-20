"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export interface EndExamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function EndExamDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: EndExamDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>평가를 종료할까요?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80">
            지금까지 제출한 답안을 바탕으로 리포트가 생성됩니다. 답변하지 않은
            문항은 <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">미답변</code>
            으로 기록됩니다. 평가를 종료하고 리포트를 생성하시겠습니까?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : "평가 종료"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
