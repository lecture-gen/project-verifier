from __future__ import annotations

from fastapi import HTTPException, status

from app.project_evaluations.domain.models import (
    FollowUpExchange,
    InterviewQuestionRead,
    InterviewTurnCreate,
    InterviewTurnFlowRequest,
    InterviewTurnFlowResponse,
    InterviewTurnFlowStatus,
    InterviewTurnMode,
    QuestionExchange,
    StudentInterviewStateRead,
)
from app.project_evaluations.interview.intent_classifier import (
    StudentIntent,
    classify_student_intent,
)
from app.project_evaluations.service import ProjectEvaluationService

SKIP_ANSWER_TEXT = "(건너뜀)"
UNANSWERED_TEXT = "(미응답)"


class InterviewTurnFlow:
    def __init__(self, service: ProjectEvaluationService) -> None:
        self.service = service

    def get_state(
        self,
        evaluation_id: str,
        session_id: str,
        session_token: str | None,
        client_id: str,
    ) -> StudentInterviewStateRead:
        session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        questions = [
            self.service.repository.to_question_read(row)
            for row in self.service.repository.list_question_rows(evaluation_id)
        ]
        turns = self.service.list_turns(evaluation_id, session_id, session_token, client_id)
        question = None
        if session.current_question_index < len(questions):
            question = questions[session.current_question_index]
        return StudentInterviewStateRead(
            session_id=session.id,
            current_question_index=session.current_question_index,
            total_questions=len(questions),
            question=question,
            turns=turns,
            is_completed=session.status.value == "completed",
        )

    def submit_answer(
        self,
        evaluation_id: str,
        session_id: str,
        payload: InterviewTurnFlowRequest,
        session_token: str | None,
        client_id: str,
    ) -> InterviewTurnFlowResponse:
        session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        questions = self.service.repository.list_question_rows(evaluation_id)
        if session.current_question_index >= len(questions):
            report = self.service.complete_session(
                evaluation_id, session_id, session_token, client_id
            )
            return InterviewTurnFlowResponse(
                status=InterviewTurnFlowStatus.COMPLETED,
                message="모든 질문 답변이 완료되어 리포트를 생성했습니다.",
                next_mode=None,
                report=report,
            )

        self._ensure_current_question_matches(payload, questions[session.current_question_index].id)
        if payload.mode == InterviewTurnMode.END:
            return self._complete_remaining(
                evaluation_id,
                session_id,
                self._combine_answer(payload.draft_answer, payload.answer_text) or UNANSWERED_TEXT,
                session_token,
                client_id,
            )

        if payload.mode == InterviewTurnMode.FOLLOW_UP:
            return self._handle_follow_up_turn(
                evaluation_id,
                session_id,
                payload,
                session_token,
                client_id,
            )

        return self._handle_initial_answer(
            evaluation_id,
            session_id,
            session.current_question_index,
            payload,
            session_token,
            client_id,
        )

    def _handle_initial_answer(
        self,
        evaluation_id: str,
        session_id: str,
        current_question_index: int,
        payload: InterviewTurnFlowRequest,
        session_token: str | None,
        client_id: str,
    ) -> InterviewTurnFlowResponse:
        intent = classify_student_intent(
            payload.answer_text, self.service._eval_llm, mode="answer"
        )
        if intent == StudentIntent.SKIP:
            return self._submit_current_turn(
                evaluation_id,
                session_id,
                SKIP_ANSWER_TEXT,
                session_token,
                client_id,
                "현재 질문을 건너뛰었습니다.",
                conversation_history=QuestionExchange(student_answer=SKIP_ANSWER_TEXT),
            )
        if intent == StudentIntent.END_EXAM:
            return self._complete_remaining(
                evaluation_id,
                session_id,
                self._combine_answer(payload.draft_answer, payload.answer_text) or UNANSWERED_TEXT,
                session_token,
                client_id,
            )

        student_answer = (
            self._combine_answer(payload.draft_answer, payload.answer_text)
            or UNANSWERED_TEXT
        )
        exchange = QuestionExchange(student_answer=student_answer)
        follow_up = self.service.preview_follow_up_question(
            evaluation_id,
            session_id,
            current_question_index,
            exchange,
            session_token,
            client_id,
        )
        if follow_up:
            updated_exchange = QuestionExchange(
                student_answer=student_answer,
                follow_ups=[
                    FollowUpExchange(
                        question=follow_up["question"],
                        reason=follow_up["reason"],
                        answer="",
                        target_rubric_index=follow_up["target_rubric_index"],
                    )
                ],
            )
            return InterviewTurnFlowResponse(
                status=InterviewTurnFlowStatus.NEED_FOLLOW_UP,
                message="답변 확인을 위해 꼬리질문이 필요합니다.",
                draft_answer=student_answer,
                follow_up_question=follow_up["question"],
                follow_up_reason=follow_up["reason"],
                next_mode=InterviewTurnMode.FOLLOW_UP,
                conversation_history=updated_exchange,
            )
        return self._submit_current_turn(
            evaluation_id,
            session_id,
            student_answer,
            session_token,
            client_id,
            "현재 질문 답변을 저장했습니다.",
            conversation_history=exchange,
        )

    def _handle_follow_up_turn(
        self,
        evaluation_id: str,
        session_id: str,
        payload: InterviewTurnFlowRequest,
        session_token: str | None,
        client_id: str,
    ) -> InterviewTurnFlowResponse:
        accumulated = self._accumulated_exchange_from_payload(payload)
        if not accumulated.follow_ups:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="follow_up 모드 요청에 누적 꼬리질문이 없습니다. 1차 답변부터 다시 진행하세요.",
            )

        intent = classify_student_intent(
            payload.answer_text, self.service._eval_llm, mode="follow_up"
        )
        if intent == StudentIntent.END_EXAM:
            return self._complete_remaining(
                evaluation_id,
                session_id,
                accumulated.student_answer or UNANSWERED_TEXT,
                session_token,
                client_id,
            )

        # 학생 give-up: 마지막 꼬리질문에 명시적으로 더 못 답하거나 다음 문제로 넘어가자고 함.
        if intent == StudentIntent.SKIP:
            finalized_exchange = self._finalize_pending_follow_up(
                accumulated, payload.answer_text, give_up=True
            )
            answer_text = self._compose_answer_text_from_exchange(finalized_exchange)
            return self._submit_current_turn(
                evaluation_id,
                session_id,
                answer_text,
                session_token,
                client_id,
                "꼬리질문 라운드를 종료하고 현재 문제를 저장했습니다.",
                allow_follow_up_required=True,
                conversation_history=finalized_exchange,
            )

        updated_exchange = self._finalize_pending_follow_up(
            accumulated, payload.answer_text, give_up=False
        )

        session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        follow_up = self.service.preview_follow_up_question(
            evaluation_id,
            session_id,
            session.current_question_index,
            updated_exchange,
            session_token,
            client_id,
        )
        if follow_up:
            new_exchange = QuestionExchange(
                student_answer=updated_exchange.student_answer,
                follow_ups=[
                    *updated_exchange.follow_ups,
                    FollowUpExchange(
                        question=follow_up["question"],
                        reason=follow_up["reason"],
                        answer="",
                        target_rubric_index=follow_up["target_rubric_index"],
                    ),
                ],
            )
            return InterviewTurnFlowResponse(
                status=InterviewTurnFlowStatus.NEED_FOLLOW_UP,
                message="추가 꼬리질문이 필요합니다.",
                draft_answer=updated_exchange.student_answer,
                follow_up_question=follow_up["question"],
                follow_up_reason=follow_up["reason"],
                next_mode=InterviewTurnMode.FOLLOW_UP,
                conversation_history=new_exchange,
            )

        answer_text = self._compose_answer_text_from_exchange(updated_exchange)
        return self._submit_current_turn(
            evaluation_id,
            session_id,
            answer_text,
            session_token,
            client_id,
            "꼬리질문 답변을 포함해 현재 문제를 저장했습니다.",
            allow_follow_up_required=True,
            conversation_history=updated_exchange,
        )

    def _accumulated_exchange_from_payload(
        self, payload: InterviewTurnFlowRequest
    ) -> QuestionExchange:
        if payload.conversation_history is not None:
            return payload.conversation_history.model_copy(deep=True)
        # 후방 호환: 옛 프론트가 draft_answer + follow_up_question 만 보낸 경우 단일 라운드로 재구성.
        if not payload.follow_up_question.strip():
            return QuestionExchange(
                student_answer=payload.draft_answer.strip() or UNANSWERED_TEXT,
            )
        return QuestionExchange(
            student_answer=payload.draft_answer.strip() or UNANSWERED_TEXT,
            follow_ups=[
                FollowUpExchange(
                    question=payload.follow_up_question.strip(),
                    reason=payload.follow_up_reason.strip(),
                    answer="",
                )
            ],
        )

    def _finalize_pending_follow_up(
        self,
        exchange: QuestionExchange,
        student_text: str,
        *,
        give_up: bool,
    ) -> QuestionExchange:
        if not exchange.follow_ups:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="응답을 채울 꼬리질문이 누적 대화에 없습니다.",
            )
        follow_ups = [item.model_copy() for item in exchange.follow_ups]
        last = follow_ups[-1]
        provided = student_text.strip()
        if give_up:
            answer = provided or "(꼬리질문 종료 — 학생이 더 답하지 않음)"
        else:
            answer = provided or UNANSWERED_TEXT
        follow_ups[-1] = FollowUpExchange(
            question=last.question,
            reason=last.reason,
            answer=answer,
            target_rubric_index=last.target_rubric_index,
        )
        return QuestionExchange(
            student_answer=exchange.student_answer,
            follow_ups=follow_ups,
        )

    def _compose_answer_text_from_exchange(
        self, exchange: QuestionExchange
    ) -> str:
        parts: list[str] = []
        student_answer = exchange.student_answer.strip()
        if student_answer:
            parts.append(student_answer)
        for index, follow_up in enumerate(exchange.follow_ups, start=1):
            question = follow_up.question.strip()
            answer = follow_up.answer.strip()
            if not question and not answer:
                continue
            block = [f"[꼬리질문 {index}] {question}".rstrip()]
            if answer:
                block.append(f"[답변 {index}] {answer}")
            parts.append("\n".join(block))
        return "\n\n".join(parts) or UNANSWERED_TEXT

    def _ensure_current_question_matches(
        self, payload: InterviewTurnFlowRequest, current_question_id: str
    ) -> None:
        if payload.current_question_id is None:
            return
        if payload.current_question_id != current_question_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "stage": "interview_turn",
                    "reason": "stale_question",
                    "message": "현재 질문이 변경되었습니다. 최신 상태를 다시 조회하세요.",
                    "current_question_id": current_question_id,
                    "submitted_question_id": payload.current_question_id,
                },
            )

    def _submit_current_turn(
        self,
        evaluation_id: str,
        session_id: str,
        answer_text: str,
        session_token: str | None,
        client_id: str,
        message: str,
        allow_follow_up_required: bool = False,
        follow_up_question: str | None = None,
        follow_up_reason: str = "",
        conversation_history: QuestionExchange | None = None,
    ) -> InterviewTurnFlowResponse:
        session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        questions = self.service.repository.list_question_rows(evaluation_id)
        if session.current_question_index >= len(questions):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="답변할 현재 질문이 없습니다.",
            )
        turn = self.service.submit_turn(
            evaluation_id,
            session_id,
            InterviewTurnCreate(
                question_id=questions[session.current_question_index].id,
                answer_text=answer_text.strip() or UNANSWERED_TEXT,
            ),
            session_token,
            client_id,
            allow_follow_up_required=allow_follow_up_required,
            follow_up_question=follow_up_question if allow_follow_up_required else None,
            follow_up_reason=follow_up_reason if allow_follow_up_required else "",
            conversation_history=conversation_history,
        )
        updated_session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        next_question = self._next_question(evaluation_id, updated_session.current_question_index)
        if next_question is None:
            return InterviewTurnFlowResponse(
                status=InterviewTurnFlowStatus.READY_TO_COMPLETE,
                message="모든 질문 답변이 저장되었습니다. 리포트를 생성할 수 있습니다.",
                turn=turn,
                next_mode=None,
            )
        return InterviewTurnFlowResponse(
            status=InterviewTurnFlowStatus.TURN_SUBMITTED,
            message=message,
            turn=turn,
            next_question=next_question,
            next_mode=InterviewTurnMode.ANSWER,
        )

    def _complete_remaining(
        self,
        evaluation_id: str,
        session_id: str,
        current_answer_text: str,
        session_token: str | None,
        client_id: str,
    ) -> InterviewTurnFlowResponse:
        starting_session = self.service.ensure_session(
            evaluation_id, session_id, session_token, client_id
        )
        current_question_index = starting_session.current_question_index
        while True:
            session = self.service.ensure_session(
                evaluation_id, session_id, session_token, client_id
            )
            questions = self.service.repository.list_question_rows(evaluation_id)
            if session.current_question_index >= len(questions):
                break
            answer_text = (
                current_answer_text
                if session.current_question_index == current_question_index
                else UNANSWERED_TEXT
            )
            self.service.submit_turn(
                evaluation_id,
                session_id,
                InterviewTurnCreate(
                    question_id=questions[session.current_question_index].id,
                    answer_text=answer_text.strip() or UNANSWERED_TEXT,
                ),
                session_token,
                client_id,
                allow_follow_up_required=True,
            )
        report = self.service.complete_session(
            evaluation_id, session_id, session_token, client_id
        )
        return InterviewTurnFlowResponse(
            status=InterviewTurnFlowStatus.COMPLETED,
            message="검증를 조기 종료하고 남은 질문을 미응답으로 처리했습니다.",
            next_mode=None,
            report=report,
        )

    def _next_question(
        self, evaluation_id: str, question_index: int
    ) -> InterviewQuestionRead | None:
        questions = self.service.repository.list_question_rows(evaluation_id)
        if question_index >= len(questions):
            return None
        return self.service.repository.to_question_read(questions[question_index])

    def _combine_answer(self, existing: str, addition: str) -> str:
        return "\n".join(part for part in [existing.strip(), addition.strip()] if part)
