"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  InterviewQuestionRead,
  InterviewTurnRead,
} from "@/lib/api/endpoints";

export interface QuestionNavigatorProps {
  questions: InterviewQuestionRead[];
  turns: InterviewTurnRead[];
  selectedQuestionId: string | null;
  onSelect: (questionId: string) => void;
}

type QuestionStatus = "answered" | "current" | "unanswered";

export function QuestionNavigator({
  questions,
  turns,
  selectedQuestionId,
  onSelect,
}: QuestionNavigatorProps) {
  const answeredIds = new Set(turns.map((turn) => turn.question_id));
  const answeredCount = answeredIds.size;
  const total = questions.length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          문제 목록
        </p>
        <p className="font-mono text-sm">
          <span className="text-foreground">
            {String(answeredCount).padStart(2, "0")}
          </span>
          <span className="text-muted-foreground">
            {" "}
            / {String(total).padStart(2, "0")} 답변 완료
          </span>
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1.5 overflow-y-auto pr-1 lg:grid-cols-4 xl:grid-cols-5">
        {questions.map((question, index) => {
          const status: QuestionStatus = answeredIds.has(question.id)
            ? "answered"
            : question.id === selectedQuestionId
              ? "current"
              : "unanswered";
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onSelect(question.id)}
              aria-current={status === "current" ? "true" : undefined}
              aria-label={`${index + 1}번 문제로 이동`}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-md border text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                status === "answered" &&
                  "border-border bg-muted text-muted-foreground hover:bg-muted/80",
                status === "current" &&
                  "border-primary bg-primary text-primary-foreground shadow-sm",
                status === "unanswered" &&
                  "border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5",
              )}
            >
              <span className="font-mono">{index + 1}</span>
              {status === "answered" && (
                <Check
                  className="absolute right-1 top-1 h-3 w-3 text-foreground/70"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-auto text-[0.7rem] leading-relaxed text-muted-foreground">
        체크 표시된 문제는 이미 답변을 제출했어요. <br/>
        내용을 확인할 수 있지만 재답변은 불가합니다.
      </p>
    </div>
  );
}
