"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ChatComposer } from "@/components/interview/chat-composer";
import {
  ConversationThread,
  type ConversationMessage,
} from "@/components/interview/conversation-thread";
import { EndExamDialog } from "@/components/interview/end-exam-dialog";
import { QuestionNavigator } from "@/components/interview/question-navigator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import {
  useCompleteInterview,
  useSubmitInterviewAnswer,
} from "@/lib/api/mutations";
import { useInterviewState } from "@/lib/api/queries";
import type {
  InterviewQuestionRead,
  InterviewTurnFlowRequest,
  InterviewTurnFlowResponse,
  InterviewTurnRead,
  QuestionExchange,
  StudentInterviewStateRead,
} from "@/lib/api/endpoints";
interface InterviewRunnerProps {
  evaluationId: string;
  sessionId: string;
  sessionToken: string;
  initialState: StudentInterviewStateRead;
  initialQuestions: InterviewQuestionRead[];
}

interface PendingFollowUp {
  question: string;
  reason: string;
}

// 답변 제출 직후 백엔드 응답이 도착하기 전까지 채팅창에 즉시 보여줄 낙관적 메시지.
// userText 는 학생이 방금 보낸 답변, assistantMeta 는 보여줄 상태 라벨.
interface OptimisticTurn {
  userText: string;
  assistantMeta: string;
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function buildReadonlyMessages(
  question: InterviewQuestionRead,
  turn: InterviewTurnRead,
): ConversationMessage[] {
  const list: ConversationMessage[] = [
    {
      key: `q-${question.id}`,
      role: "assistant",
      meta: "본 질문",
      text: question.question,
    },
  ];
  const exchange = turn.conversation_history;
  if (exchange?.student_answer) {
    list.push({
      key: `a-initial-${question.id}`,
      role: "user",
      meta: "답변",
      text: exchange.student_answer,
    });
  } else if (turn.answer_text) {
    list.push({
      key: `a-initial-${question.id}`,
      role: "user",
      meta: "답변",
      text: turn.answer_text,
    });
  }
  exchange?.follow_ups?.forEach((fu, index) => {
    list.push({
      key: `fq-${question.id}-${index}`,
      role: "assistant",
      meta: "꼬리질문",
      text: fu.question,
    });
    if (fu.answer) {
      list.push({
        key: `fa-${question.id}-${index}`,
        role: "user",
        meta: "답변",
        text: fu.answer,
      });
    }
  });
  return list;
}

function buildActiveMessages(
  question: InterviewQuestionRead,
  conversation: QuestionExchange | null,
): ConversationMessage[] {
  const list: ConversationMessage[] = [
    {
      key: `q-${question.id}`,
      role: "assistant",
      meta: "본 질문",
      text: question.question,
    },
  ];
  if (conversation?.student_answer) {
    list.push({
      key: `a-initial-${question.id}`,
      role: "user",
      meta: "답변",
      text: conversation.student_answer,
    });
  }
  conversation?.follow_ups?.forEach((fu, index) => {
    list.push({
      key: `fq-${question.id}-${index}`,
      role: "assistant",
      meta: "꼬리질문",
      text: fu.question,
      pending: !fu.answer,
    });
    if (fu.answer) {
      list.push({
        key: `fa-${question.id}-${index}`,
        role: "user",
        meta: "답변",
        text: fu.answer,
      });
    }
  });
  return list;
}

function pickInitialSelected(
  questions: InterviewQuestionRead[],
  state: StudentInterviewStateRead,
): string | null {
  if (state.question?.id) return state.question.id;
  const answered = new Set((state.turns ?? []).map((turn) => turn.question_id));
  const firstUnanswered = questions.find((q) => !answered.has(q.id));
  return firstUnanswered?.id ?? questions[0]?.id ?? null;
}

function findNextUnanswered(
  questions: InterviewQuestionRead[],
  turns: InterviewTurnRead[],
  afterQuestionId: string | null,
): string | null {
  const answered = new Set(turns.map((turn) => turn.question_id));
  const startIndex = afterQuestionId
    ? questions.findIndex((q) => q.id === afterQuestionId)
    : -1;
  for (let i = startIndex + 1; i < questions.length; i += 1) {
    if (!answered.has(questions[i].id)) return questions[i].id;
  }
  for (let i = 0; i <= startIndex && i < questions.length; i += 1) {
    if (!answered.has(questions[i].id)) return questions[i].id;
  }
  return null;
}

export function InterviewRunner({
  evaluationId,
  sessionId,
  sessionToken,
  initialState,
  initialQuestions,
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

  const state = stateQuery.data ?? initialState;
  const questions = initialQuestions;
  const turns: InterviewTurnRead[] = state.turns ?? [];

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    () => pickInitialSelected(questions, initialState),
  );
  const [answer, setAnswer] = useState("");
  const [conversation, setConversation] = useState<QuestionExchange | null>(null);
  const [pendingFollowUp, setPendingFollowUp] = useState<PendingFollowUp | null>(
    null,
  );
  const [optimistic, setOptimistic] = useState<OptimisticTurn | null>(null);
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  // 백엔드가 알려주는 다음 문제가 갱신되면, 사용자가 따로 선택하지 않은 상태에서만 자동 추종.
  useEffect(() => {
    setSelectedQuestionId((prev) => {
      if (prev) {
        const stillExists = questions.some((q) => q.id === prev);
        if (stillExists) return prev;
      }
      return pickInitialSelected(questions, state);
    });
  }, [questions, state]);

  // 백엔드 상태가 완료되면 리포트로 이동.
  useEffect(() => {
    if (state.is_completed) {
      router.replace(
        `/interview/${evaluationId}/report?sessionId=${sessionId}`,
      );
    }
  }, [state.is_completed, router, evaluationId, sessionId]);

  // 선택 문제가 바뀌면 입력/임시 상태 초기화.
  useEffect(() => {
    setAnswer("");
    setConversation(null);
    setPendingFollowUp(null);
    setOptimistic(null);
  }, [selectedQuestionId]);

  const selectedQuestion = useMemo<InterviewQuestionRead | null>(() => {
    if (!selectedQuestionId) return null;
    return questions.find((q) => q.id === selectedQuestionId) ?? null;
  }, [questions, selectedQuestionId]);

  const selectedTurn = useMemo<InterviewTurnRead | null>(() => {
    if (!selectedQuestionId) return null;
    return turns.find((t) => t.question_id === selectedQuestionId) ?? null;
  }, [turns, selectedQuestionId]);

  const readonly = selectedTurn !== null;

  const messages = useMemo<ConversationMessage[]>(() => {
    if (!selectedQuestion) return [];
    if (readonly && selectedTurn) {
      return buildReadonlyMessages(selectedQuestion, selectedTurn);
    }
    const base = buildActiveMessages(selectedQuestion, conversation);
    if (!optimistic) return base;
    // 낙관적: 학생 답변을 곧장 추가하고, AI 응답 자리에 pending placeholder 를 둔다.
    // 실제 응답이 도착하면 setOptimistic(null) 로 사라지고 base 흐름이 그 자리를 채운다.
    return [
      ...base,
      {
        key: `optimistic-user-${selectedQuestion.id}`,
        role: "user",
        meta: "답변",
        text: optimistic.userText,
      },
      {
        key: `optimistic-assistant-${selectedQuestion.id}`,
        role: "assistant",
        meta: optimistic.assistantMeta,
        text: "",
        pending: true,
      },
    ];
  }, [selectedQuestion, readonly, selectedTurn, conversation, optimistic]);

  const submitting =
    submitMutation.isPending || completeMutation.isPending;

  const handleResponse = useCallback(
    (response: InterviewTurnFlowResponse) => {
      switch (response.status) {
        case "need_follow_up": {
          if (response.conversation_history) {
            setConversation(response.conversation_history);
          }
          setPendingFollowUp({
            question: response.follow_up_question ?? "",
            reason: response.follow_up_reason ?? "",
          });
          setAnswer("");
          return;
        }
        case "turn_submitted":
        case "ready_to_complete": {
          toast.success(response.message || "답변을 저장했습니다.");
          setConversation(null);
          setPendingFollowUp(null);
          setAnswer("");
          const nextId = findNextUnanswered(
            questions,
            [...turns, ...(response.turn ? [response.turn] : [])],
            selectedQuestionId,
          );
          if (nextId) setSelectedQuestionId(nextId);
          return;
        }
        case "completed": {
          toast.success("평가가 완료되어 리포트로 이동합니다.");
          // 세션 토큰 cookie 는 12시간 max-age 로 자동 만료되므로 명시적 cleanup 하지 않는다.
          // 여기서 cookie 를 지우면 SSR 인 report 페이지가 토큰을 못 읽어 join 으로 redirect 된다.
          router.replace(
            `/interview/${evaluationId}/report?sessionId=${sessionId}`,
          );
          return;
        }
        default: {
          toast.message(response.message || "답변을 받았습니다.");
        }
      }
    },
    [questions, turns, selectedQuestionId, router, evaluationId, sessionId],
  );

  const submitAnswer = useCallback(async () => {
    if (!selectedQuestion) {
      toast.error("진행 가능한 질문이 없습니다.");
      return;
    }
    if (readonly) {
      return;
    }
    const trimmed = answer.trim();
    if (!trimmed) {
      toast.error("답변을 입력해 주세요.");
      return;
    }

    const payload: InterviewTurnFlowRequest =
      pendingFollowUp && conversation
        ? {
            mode: "follow_up",
            answer_text: trimmed,
            draft_answer: conversation.student_answer ?? "",
            follow_up_question: pendingFollowUp.question,
            follow_up_reason: pendingFollowUp.reason,
            current_question_id: selectedQuestion.id,
            conversation_history: conversation,
          }
        : {
            mode: "answer",
            answer_text: trimmed,
            draft_answer: "",
            follow_up_question: "",
            follow_up_reason: "",
            current_question_id: selectedQuestion.id,
            conversation_history: null,
          };

    // 낙관적 UI: 전송 즉시 사용자 답변 + AI pending 말풍선 표시.
    // 실패 시 catch 에서 원복하고 textarea 입력을 복원한다.
    setOptimistic({
      userText: trimmed,
      assistantMeta: pendingFollowUp ? "응답 평가 중" : "꼬리질문 판단 중",
    });
    setAnswer("");

    try {
      const response = await submitMutation.mutateAsync(payload);
      setOptimistic(null);
      handleResponse(response);
    } catch (error) {
      setOptimistic(null);
      setAnswer(trimmed);
      toast.error(describeError(error, "답변 제출에 실패했습니다."));
    }
  }, [
    answer,
    conversation,
    handleResponse,
    pendingFollowUp,
    readonly,
    selectedQuestion,
    submitMutation,
  ]);

  const handleEndExam = useCallback(async () => {
    try {
      // 미답변 문항은 backend `_complete_remaining` 이 `(미응답)` 으로 채운다.
      await submitMutation.mutateAsync({
        mode: "end",
        answer_text: "",
        draft_answer: "",
        follow_up_question: "",
        follow_up_reason: "",
        current_question_id: selectedQuestion?.id ?? null,
        conversation_history: null,
      });
      // 세션 cookie 는 자동 만료에 맡긴다. 여기서 지우면 SSR 인 report 페이지가
      // 토큰을 못 읽어 join 으로 돌아간다.
      setEndDialogOpen(false);
      router.replace(
        `/interview/${evaluationId}/report?sessionId=${sessionId}`,
      );
    } catch (error) {
      toast.error(describeError(error, "평가 종료에 실패했습니다."));
    }
  }, [
    selectedQuestion,
    sessionId,
    router,
    evaluationId,
    submitMutation,
  ]);

  const handleSelectQuestion = (questionId: string) => {
    setSelectedQuestionId(questionId);
  };

  const composerPlaceholder = pendingFollowUp
    ? "꼬리질문에 답변하세요. Enter 로 전송, Shift+Enter 로 줄바꿈."
    : "답변을 입력하세요. Enter 로 전송, Shift+Enter 로 줄바꿈.";

  return (
    <div className="flex h-svh w-full flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            평가 진행
          </p>
          <h1 className="truncate font-serif text-lg leading-tight">
            프로젝트 검증 인터뷰
          </h1>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEndDialogOpen(true)}
          disabled={submitting}
        >
          평가 종료
        </Button>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 px-6 py-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden min-h-0 rounded-lg border border-border/60 bg-muted/20 p-4 lg:flex lg:flex-col">
          <QuestionNavigator
            questions={questions}
            turns={turns}
            selectedQuestionId={selectedQuestionId}
            onSelect={handleSelectQuestion}
          />
        </aside>

        <section className="flex min-h-0 flex-col gap-3">
          {selectedQuestion ? (
            <div className="flex shrink-0 items-center justify-between gap-2 rounded-md border border-border/60 bg-card/60 px-4 py-2 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">
                문제 {questions.findIndex((q) => q.id === selectedQuestion.id) + 1}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedQuestion.bloom_level}</Badge>
                <Badge variant="default">{selectedQuestion.max_points}점 만점</Badge>
                {readonly && <Badge variant="outline">답변 완료</Badge>}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            <ConversationThread
              messages={messages}
              emptyState={
                selectedQuestion ? "질문을 받는 중입니다." : "표시할 문제가 없습니다."
              }
              className="h-full"
            />
          </div>

          <div className="shrink-0">
            {readonly ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
                이미 답변을 제출한 문제입니다. <br/>
                답변하지 않은 문제 번호를 눌러서 이동하세요.
              </div>
            ) : (
              <ChatComposer
                value={answer}
                onChange={setAnswer}
                onSubmit={() => {
                  void submitAnswer();
                }}
                disabled={!selectedQuestion}
                isSubmitting={submitting}
                placeholder={composerPlaceholder}
              />
            )}
          </div>
        </section>
      </main>

      <EndExamDialog
        open={endDialogOpen}
        onOpenChange={setEndDialogOpen}
        onConfirm={() => {
          void handleEndExam();
        }}
        isSubmitting={submitMutation.isPending}
      />
    </div>
  );
}
