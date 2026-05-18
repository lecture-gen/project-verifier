"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MicButton } from "@/components/audio/mic-button";
import { TtsButton } from "@/components/audio/tts-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  useAbortInterview,
  useCompleteInterview,
  useSubmitInterviewAnswer,
} from "@/lib/api/mutations";
import { useInterviewState } from "@/lib/api/queries";
import type {
  InterviewQuestionRead,
  InterviewTurnFlowResponse,
  StudentInterviewStateRead,
} from "@/lib/api/endpoints";
import { clearInterviewSession } from "@/lib/session/interview";

interface InterviewRunnerProps {
  evaluationId: string;
  sessionId: string;
  sessionToken: string;
  initialState: StudentInterviewStateRead;
}

interface PendingFollowUp {
  question: string;
  reason: string;
  draft_answer: string;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function InterviewRunner({
  evaluationId,
  sessionId,
  sessionToken,
  initialState,
}: InterviewRunnerProps) {
  const router = useRouter();

  const stateQuery = useInterviewState(evaluationId, sessionId, sessionToken, {
    initialData: initialState,
  });

  const submitMutation = useSubmitInterviewAnswer(
    evaluationId,
    sessionId,
    sessionToken,
  );
  const completeMutation = useCompleteInterview(
    evaluationId,
    sessionId,
    sessionToken,
  );
  const abortMutation = useAbortInterview(evaluationId, sessionId, sessionToken);

  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUp | null>(
    null,
  );
  const [readyToComplete, setReadyToComplete] = useState(
    initialState.is_completed,
  );
  const [ttsAutoplay, setTtsAutoplay] = useState(false);

  const state = stateQuery.data ?? initialState;
  const question: InterviewQuestionRead | null = state.question ?? null;
  const progress = useMemo(
    () => ({
      index: state.current_question_index + 1,
      total: state.total_questions,
    }),
    [state.current_question_index, state.total_questions],
  );

  // 세션이 이미 끝나 있으면 리포트로 바로 보낸다.
  useEffect(() => {
    if (state.is_completed) {
      router.replace(
        `/interview/${evaluationId}/report?sessionId=${sessionId}`,
      );
    }
  }, [state.is_completed, router, evaluationId, sessionId]);

  function handleResponse(response: InterviewTurnFlowResponse) {
    switch (response.status) {
      case "need_follow_up": {
        toast.message(
          response.follow_up_reason
            ? `꼬리질문: ${response.follow_up_reason}`
            : "꼬리질문이 추가됐어요.",
        );
        setPendingFollowUp({
          question: response.follow_up_question ?? "",
          reason: response.follow_up_reason ?? "",
          draft_answer: response.draft_answer ?? "",
        });
        setAnswer("");
        setInterim("");
        return;
      }
      case "turn_submitted": {
        toast.success(response.message || "답변을 저장했습니다.");
        setPendingFollowUp(null);
        setAnswer("");
        setInterim("");
        setReadyToComplete(false);
        return;
      }
      case "ready_to_complete": {
        toast.success(
          response.message || "마지막 질문이에요. 종료해서 리포트를 받으세요.",
        );
        setPendingFollowUp(null);
        setAnswer("");
        setInterim("");
        setReadyToComplete(true);
        return;
      }
      case "completed": {
        toast.success("인터뷰가 완료되어 리포트로 이동합니다.");
        clearInterviewSession(sessionId).catch(() => undefined);
        router.replace(
          `/interview/${evaluationId}/report?sessionId=${sessionId}`,
        );
        return;
      }
      default: {
        toast.message(response.message || "답변을 받았습니다.");
      }
    }
  }

  async function onSubmitAnswer() {
    if (!question) {
      toast.error("진행 가능한 질문이 없습니다. 상태를 새로고침해 주세요.");
      return;
    }
    if (!answer.trim() && !pendingFollowUp) {
      toast.error("답변을 입력해 주세요.");
      return;
    }

    try {
      const response = await submitMutation.mutateAsync(
        pendingFollowUp
          ? {
              mode: "follow_up",
              answer_text: answer,
              draft_answer: pendingFollowUp.draft_answer,
              follow_up_question: pendingFollowUp.question,
              follow_up_reason: pendingFollowUp.reason,
              current_question_id: question.id,
            }
          : {
              mode: "answer",
              answer_text: answer,
              draft_answer: "",
              follow_up_question: "",
              follow_up_reason: "",
              current_question_id: question.id,
            },
      );
      handleResponse(response);
    } catch (error) {
      toast.error(describeError(error, "답변 제출에 실패했습니다."));
    }
  }

  async function onComplete() {
    try {
      await completeMutation.mutateAsync();
      clearInterviewSession(sessionId).catch(() => undefined);
      toast.success("인터뷰를 종료했습니다. 리포트로 이동합니다.");
      router.replace(`/interview/${evaluationId}/report?sessionId=${sessionId}`);
    } catch (error) {
      toast.error(describeError(error, "인터뷰 종료에 실패했습니다."));
    }
  }

  async function onAbort() {
    const confirmed = window.confirm(
      "인터뷰를 중단할까요? 지금까지 진행한 내용으로 리포트가 생성됩니다.",
    );
    if (!confirmed) return;
    try {
      await abortMutation.mutateAsync();
      clearInterviewSession(sessionId).catch(() => undefined);
      toast.success("인터뷰가 중단되었습니다.");
      router.replace(`/interview/${evaluationId}/report?sessionId=${sessionId}`);
    } catch (error) {
      toast.error(describeError(error, "인터뷰 중단에 실패했습니다."));
    }
  }

  const submitting =
    submitMutation.isPending || completeMutation.isPending || abortMutation.isPending;

  // 현재 사용자가 들어야 하는 텍스트: 꼬리질문이 있으면 꼬리질문, 아니면 본 질문.
  const speakingText = pendingFollowUp?.question || question?.question || "";

  const handleFinalTranscript = (text: string) => {
    setAnswer((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
    setInterim("");
  };
  const handleInterimTranscript = (text: string) => {
    setInterim(text);
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)]">
      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-baseline justify-between">
          <span className="font-serif text-[5rem] leading-none tracking-tight">
            {String(progress.index).padStart(2, "0")}
          </span>
          <span className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            {String(progress.index).padStart(2, "0")} /
            {String(progress.total).padStart(2, "0")}
          </span>
        </div>
        <div>
          <h1 className="font-serif text-3xl leading-tight">인터뷰 진행</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            한 질문에 답하면 시스템이 검증을 위한 꼬리질문을 던질 수 있어요. 마지막
            질문까지 마치거나 “종료”를 누르면 리포트가 생성됩니다.
          </p>
        </div>
        <Separator />
        <div className="space-y-3 text-sm">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onComplete}
            disabled={submitting}
          >
            {readyToComplete ? "리포트 받기" : "지금 종료하고 리포트"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={onAbort}
            disabled={submitting}
          >
            인터뷰 중단
          </Button>
        </div>
      </aside>

      <section className="space-y-6">
        {question ? (
          <Card>
            <CardHeader className="space-y-2 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{question.bloom_level}</Badge>
                  <Badge variant="outline">{question.difficulty}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5"
                      checked={ttsAutoplay}
                      onChange={(event) => setTtsAutoplay(event.target.checked)}
                    />
                    자동 음성 재생
                  </Label>
                  <TtsButton text={speakingText} autoplay={ttsAutoplay} />
                </div>
              </div>
              <CardTitle className="text-xl leading-snug">
                {question.question}
              </CardTitle>
              {question.intent && (
                <p className="text-sm text-muted-foreground">
                  의도 · {question.intent}
                </p>
              )}
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              현재 진행할 질문이 없습니다. “리포트 받기”로 마무리하세요.
            </CardContent>
          </Card>
        )}

        {pendingFollowUp && (
          <Card className="border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">꼬리질문</CardTitle>
              {pendingFollowUp.reason && (
                <p className="text-sm text-muted-foreground">
                  {pendingFollowUp.reason}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{pendingFollowUp.question}</p>
              {pendingFollowUp.draft_answer && (
                <p className="rounded border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  방금 답변:{" "}
                  <span className="text-foreground/80">
                    {pendingFollowUp.draft_answer}
                  </span>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">답변</CardTitle>
            <MicButton
              onFinalTranscript={handleFinalTranscript}
              onInterimTranscript={handleInterimTranscript}
              disabled={!question || submitting}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={8}
              placeholder={
                pendingFollowUp
                  ? "꼬리질문에 대한 답변을 작성해 주세요."
                  : "충분히 구체적으로 답해 주세요. 결정의 근거나 코드/문서 위치를 함께 적으면 좋습니다."
              }
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={!question || submitting}
            />
            {interim && (
              <p className="rounded border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                인식 중 · <span className="text-foreground/80">{interim}</span>
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
              {pendingFollowUp && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPendingFollowUp(null);
                    setAnswer("");
                    setInterim("");
                  }}
                  disabled={submitting}
                >
                  꼬리질문 무시하기
                </Button>
              )}
              <Button type="button" onClick={onSubmitAnswer} disabled={submitting}>
                {submitMutation.isPending
                  ? "전송 중…"
                  : pendingFollowUp
                    ? "꼬리질문 답변 제출"
                    : "답변 제출"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
