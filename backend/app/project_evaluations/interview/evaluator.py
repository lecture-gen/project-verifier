from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import (
    FinalizeAnswerSchema,
    FollowUpQuestionSchema,
    JudgeAnswerSchema,
    build_finalize_prompt,
    build_follow_up_prompt,
    build_judge_prompt,
)
from app.project_evaluations.domain.models import (
    QuestionExchange,
    RubricScoreItem,
)
from app.project_evaluations.persistence.models import InterviewQuestionRow
from app.project_evaluations.persistence.repository import (
    from_json,
    refs_from_json,
)


def conversation_history_text(exchange: QuestionExchange | None) -> str:
    if exchange is None:
        return "(이전 대화 없음)"
    parts = [f"최초 답변: {exchange.student_answer.strip() or '(답변 없음)'}"]
    for index, follow_up in enumerate(exchange.follow_ups, start=1):
        parts.append(
            f"꼬리질문 {index}: {follow_up.question.strip()}\n"
            f"꼬리질문 필요 이유: {follow_up.reason.strip() or '(이유 없음)'}\n"
            f"학생 답변: {follow_up.answer.strip() or '(답변 없음)'}"
        )
    return "\n\n".join(parts)


def _source_snippets(question: InterviewQuestionRow) -> list[str]:
    source_refs = refs_from_json(question.source_refs_json)
    if not source_refs:
        raise RuntimeError("답변 평가에 사용할 question source refs가 없습니다.")
    return [f"{ref.path}: {ref.snippet}" for ref in source_refs if ref.snippet]


def _scoring_rubric_payload(question: InterviewQuestionRow) -> list[dict[str, object]]:
    raw = from_json(question.scoring_rubric_json, [])
    if not isinstance(raw, list) or not raw:
        raise RuntimeError("답변 평가에 사용할 채점 기준표가 없습니다.")
    payload: list[dict[str, object]] = []
    for index, item in enumerate(raw):
        description = str(item.get("description", "")).strip()
        points = int(item.get("points", 0))
        if not description or points <= 0:
            raise RuntimeError(
                f"채점 기준표 항목 #{index}이 비어 있거나 만점이 0 이하입니다. description={description!r}, points={points}"
            )
        payload.append({"description": description, "points": points, "index": index})
    return payload


def _expected_rubric_signature(scoring_rubric: list[dict[str, object]]) -> list[tuple[int, str, int]]:
    return [
        (int(item["index"]), str(item["description"]), int(item["points"]))
        for item in scoring_rubric
    ]


def _validate_rubric_scores(
    expected: list[tuple[int, str, int]],
    rubric_scores: list[RubricScoreItem],
    total_score: float,
) -> None:
    if len(rubric_scores) != len(expected):
        raise RuntimeError(
            "LLM 평가 결과의 채점 기준 항목 수가 입력과 다릅니다. "
            f"expected={len(expected)}, actual={len(rubric_scores)}"
        )
    sorted_scores = sorted(rubric_scores, key=lambda item: item.criterion_index)
    for expected_item, actual in zip(expected, sorted_scores):
        ex_index, ex_description, ex_max = expected_item
        if actual.criterion_index != ex_index:
            raise RuntimeError(
                f"채점 기준 인덱스 불일치: expected={ex_index}, actual={actual.criterion_index}"
            )
        if actual.criterion.strip() != ex_description:
            raise RuntimeError(
                "채점 기준 description 불일치: "
                f"expected={ex_description!r}, actual={actual.criterion!r}"
            )
        if actual.max_points != ex_max:
            raise RuntimeError(
                f"채점 기준 max_points 불일치 (#{ex_index}): expected={ex_max}, actual={actual.max_points}"
            )
        if actual.score < 0 or actual.score > ex_max:
            raise RuntimeError(
                f"채점 점수 범위 위반 (#{ex_index}): 0..{ex_max} 사이여야 하는데 actual={actual.score}"
            )
    awarded_sum = sum(item.score for item in sorted_scores)
    if int(round(total_score)) != awarded_sum:
        raise RuntimeError(
            "LLM 최상위 score가 rubric_scores 합과 일치하지 않습니다. "
            f"score={total_score}, sum(rubric_scores)={awarded_sum}"
        )


def judge_answer(
    question: InterviewQuestionRow,
    answer_text: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
    follow_up_count: int = 0,
) -> dict[str, object]:
    if llm is None or not llm.enabled():
        raise RuntimeError(
            "답변 평가에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    result: JudgeAnswerSchema = llm.parse(
        build_judge_prompt(
            question=question.question,
            intent=question.intent,
            expected_answer=question.expected_answer,
            scoring_rubric=scoring_rubric,
            answer_text=answer_text,
            source_snippets=_source_snippets(question),
            conversation_history=conversation_history,
            follow_up_count=follow_up_count,
        ),
        JudgeAnswerSchema,
        max_tokens=1200,
    )
    reason = result.reason.strip()
    request_to_generator = result.request_to_generator.strip()
    if result.needs_follow_up and not request_to_generator:
        raise RuntimeError(
            "평가관이 꼬리질문 필요 판단을 했지만 생성기 요청이 비어 있습니다."
        )
    if not result.needs_follow_up and request_to_generator:
        raise RuntimeError(
            "평가관이 꼬리질문 불필요 판단을 했지만 생성기 요청을 함께 반환했습니다."
        )
    return {
        "needs_follow_up": result.needs_follow_up,
        "reason": reason,
        "request_to_generator": request_to_generator,
    }


def generate_follow_up_question(
    question: InterviewQuestionRow,
    answer_text: str,
    judge_reason: str,
    request_to_generator: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
) -> str:
    if llm is None or not llm.enabled():
        raise RuntimeError(
            "꼬리질문 생성에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    result: FollowUpQuestionSchema = llm.parse(
        build_follow_up_prompt(
            question=question.question,
            intent=question.intent,
            expected_answer=question.expected_answer,
            scoring_rubric=scoring_rubric,
            answer_text=answer_text,
            judge_reason=judge_reason,
            request_to_generator=request_to_generator,
            source_snippets=_source_snippets(question),
            conversation_history=conversation_history,
        ),
        FollowUpQuestionSchema,
        max_tokens=800,
    )
    follow_up_question = result.follow_up_question.strip()
    if not follow_up_question:
        raise RuntimeError("꼬리질문 생성 결과가 비어 있습니다.")
    return follow_up_question


def finalize_oral_evaluation(
    question: InterviewQuestionRow,
    answer_text: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
) -> dict[str, object]:
    if llm is None or not llm.enabled():
        raise RuntimeError(
            "최종 채점에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    expected_signature = _expected_rubric_signature(scoring_rubric)
    result: FinalizeAnswerSchema = llm.parse(
        build_finalize_prompt(
            question=question.question,
            intent=question.intent,
            expected_answer=question.expected_answer,
            scoring_rubric=scoring_rubric,
            answer_text=answer_text,
            source_snippets=_source_snippets(question),
            conversation_history=conversation_history,
        ),
        FinalizeAnswerSchema,
        max_tokens=2000,
    )

    rubric_scores: list[RubricScoreItem] = [
        RubricScoreItem(
            criterion=item.criterion,
            criterion_index=item.criterion_index,
            score=item.score,
            max_points=item.max_points,
            rationale=item.rationale,
        )
        for item in result.rubric_scores
    ]
    _validate_rubric_scores(expected_signature, rubric_scores, result.score)

    return {
        "score": float(result.score),
        "evaluation_summary": result.evaluation_summary,
        "rubric_scores": rubric_scores,
        "evidence_matches": [*result.evidence_matches, *result.authenticity_signals],
        "evidence_mismatches": [
            *result.evidence_mismatches,
            *result.missing_expected_points,
        ],
        "suspicious_points": list(result.suspicious_points),
        "strengths": list(result.strengths),
    }


def evaluate_answer(
    question: InterviewQuestionRow,
    answer_text: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
    follow_up_count: int = 0,
) -> dict[str, object]:
    judge_result = judge_answer(
        question,
        answer_text,
        llm=llm,
        conversation_history=conversation_history,
        follow_up_count=follow_up_count,
    )
    if judge_result["needs_follow_up"]:
        follow_up_question = generate_follow_up_question(
            question,
            answer_text,
            judge_reason=str(judge_result["reason"]),
            request_to_generator=str(judge_result["request_to_generator"]),
            llm=llm,
            conversation_history=conversation_history,
        )
        return {
            "needs_follow_up": True,
            "follow_up_reason": str(judge_result["reason"]),
            "follow_up_question": follow_up_question,
        }
    finalized = finalize_oral_evaluation(
        question,
        answer_text,
        llm=llm,
        conversation_history=conversation_history,
    )
    return {
        "needs_follow_up": False,
        "follow_up_reason": "",
        "follow_up_question": None,
        **finalized,
    }
