"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MicButton } from "@/components/audio/mic-button";
import { TtsButton } from "@/components/audio/tts-button";
import {
  ConversationThread,
  type ConversationMessage,
} from "@/components/interview/conversation-thread";
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
  QuestionExchange,
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
  const [conversation, setConversation] = useState<QuestionExchange | null>(null);
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

  useEffect(() => {
    if (state.is_completed) {
      router.replace(
        `/interview/${evaluationId}/report?sessionId=${sessionId}`,
      );
    }
  }, [state.is_completed, router, evaluationId, sessionId]);

  // 현재 문제가 바뀌면 채팅창을 초기화한다.
  useEffect(() => {
    setConversation(null);
    setPendingFollowUp(null);
    setAnswer("");
    setInterim("");
  }, [question?.id]);

  const messages = useMemo<ConversationMessage[]>(() => {
    const list: ConversationMessage[] = [];
    if (question) {
      list.push({
        key: `q-${question.id}`,
        role: "assistant",
        meta: "본 질문",
        text: question.question,
        subtext: question.intent ? `출제 의도 · ${question.intent}` : undefined,
      });
    }
    if (conversation) {
      if (conversation.student_answer) {
        list.push({
          key: `a-initial-${question?.id ?? ""}`,
          role: "user",
          meta: "1차 답변",
          text: conversation.student_answer,
        });
      }
      conversation.follow_ups?.forEach((exchange, index) => {
        const roundLabel = `라운드 ${index + 1}`;
        list.push({
          key: `fq-${question?.id ?? ""}-${index}`,
          role: "assistant",
          meta: `꼬리질문 · ${roundLabel}`,
          text: exchange.question,
          subtext: exchange.reason || undefined,
          pending: !exchange.answer,
        });
        if (exchange.answer) {
          list.push({
            key: `fa-${question?.id ?? ""}-${index}`,
            role: "user",
            meta: `답변 · ${roundLabel}`,
            text: exchange.answer,
          });
        }
      });
    }
    return list;
  }, [question, conversation]);

  function applyResponseConversation(response: InterviewTurnFlowResponse) {
    if (response.conversation_history) {
      setConversation(response.conversation_history);
    }
  }

  function handleResponse(response: InterviewTurnFlowResponse) {
    switch (response.status) {
      case "need_follow_up": {
        applyResponseConversation(response);
        const followUp: PendingFollowUp = {
          question: response.follow_up_question ?? "",
          reason: response.follow_up_reason ?? "",
        };
        setPendingFollowUp(followUp);
        setAnswer("");
        setInterim("");
        toast.message(
          followUp.reason
            ? `꼬리질문: ${followUp.reason}`
            : "꼬리질문이 추가됐어요.",
        );
        return;
      }
      case "turn_submitted": {
        toast.success(response.message || "답변을 저장했습니다.");
        setConversation(null);
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
        setConversation(null);
        setPendingFollowUp(null);
        setAnswer("");
        setInterim("");
        setReadyToComplete(true);
        return;
      }
      case "completed": {
        toast.success("검증가 완료되어 리포트로 이동합니다.");
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

  async function submitAnswerText(textOverride?: string) {
    if (!question) {
      toast.error("진행 가능한 질문이 없습니다. 상태를 새로고침해 주세요.");
      return;
    }
    const trimmed = (textOverride ?? answer).trim();
    if (!trimmed && !pendingFollowUp) {
      toast.error("답변을 입력해 주세요.");
      return;
    }

    try {
      const response = await submitMutation.mutateAsync(
        pendingFollowUp && conversation
          ? {
              mode: "follow_up",
              answer_text: trimmed,
              draft_answer: conversation.student_answer ?? "",
              follow_up_question: pendingFollowUp.question,
              follow_up_reason: pendingFollowUp.reason,
              current_question_id: question.id,
              conversation_history: conversation,
            }
          : {
              mode: "answer",
              answer_text: trimmed,
              draft_answer: "",
              follow_up_question: "",
              follow_up_reason: "",
              current_question_id: question.id,
              conversation_history: null,
            },
      );
      handleResponse(response);
    } catch (error) {
      toast.error(describeError(error, "답변 제출에 실패했습니다."));
    }
  }

  async function onSubmitAnswer() {
    await submitAnswerText();
  }

  async function onSkipFollowUp() {
    if (!pendingFollowUp) return;
    const giveUpText =
      answer.trim() || "다음 문제로 넘어갈게요";
    await submitAnswerText(giveUpText);
  }

  async function onComplete() {
    try {
      await completeMutation.mutateAsync();
      clearInterviewSession(sessionId).catch(() => undefined);
      toast.success("검증를 종료했습니다. 리포트로 이동합니다.");
      router.replace(`/interview/${evaluationId}/report?sessionId=${sessionId}`);
    } catch (error) {
      toast.error(describeError(error, "검증 종료에 실패했습니다."));
    }
  }

  async function onAbort() {
    const confirmed = window.confirm(
      "검증를 중단할까요? 지금까지 진행한 내용으로 리포트가 생성됩니다.",
    );
    if (!confirmed) return;
    try {
      await abortMutation.mutateAsync();
      clearInterviewSession(sessionId).catch(() => undefined);
      toast.success("검증가 중단되었습니다.");
      router.replace(`/interview/${evaluationId}/report?sessionId=${sessionId}`);
    } catch (error) {
      toast.error(describeError(error, "검증 중단에 실패했습니다."));
    }
  }

  const submitting =
    submitMutation.isPending || completeMutation.isPending || abortMutation.isPending;

  // TTS 대상 텍스트는 진행 중 라운드의 마지막 assistant 메시지(꼬리질문 또는 본 질문).
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
          <h1 className="font-serif text-3xl leading-tight">검증 진행</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            본 질문에 답하면 시스템이 부족한 부분을 보충받기 위해 꼬리질문을 던질 수 있어요.
            한 문제 안에서 여러 차례 꼬리질문이 누적될 수 있습니다.
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
            검증 중단
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
                  <Badge variant="default">{question.max_points}점 만점</Badge>
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
              <CardTitle className="text-base text-muted-foreground">
                현재 문제 — 진행 라운드 {conversation?.follow_ups?.length ?? 0}회
              </CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              현재 진행할 질문이 없습니다. “리포트 받기”로 마무리하세요.
            </CardContent>
          </Card>
        )}

        <ConversationThread
          messages={messages}
          emptyState="질문을 받는 중입니다."
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">
              {pendingFollowUp ? "꼬리질문 답변" : "답변"}
            </CardTitle>
            <MicButton
              onFinalTranscript={handleFinalTranscript}
              onInterimTranscript={handleInterimTranscript}
              disabled={!question || submitting}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={6}
              placeholder={
                pendingFollowUp
                  ? "꼬리질문에 대한 답변을 작성해 주세요. 더 답할 게 없다면 ‘다음 문제로 넘어갈게요’ 버튼을 눌러도 됩니다."
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
                  onClick={onSkipFollowUp}
                  disabled={submitting}
                >
                  다음 문제로 넘어갈게요
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
