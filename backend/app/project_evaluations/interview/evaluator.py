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
    used_rubric_indices: list[int] | None = None,
) -> dict[str, object]:
    if llm is None or not llm.enabled():
        raise RuntimeError(
            "답변 평가에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    rubric_size = len(scoring_rubric)
    used_set = {int(i) for i in (used_rubric_indices or []) if i is not None}
    available_indices = [i for i in range(rubric_size) if i not in used_set]
    if not available_indices:
        # 모든 채점 기준 항목이 이미 한 번씩 출제됨 → 더 이상 꼬리질문할 수 있는 항목이 없으므로
        # judge에게 묻지 않고 즉시 종료. (정책: 루브릭 항목당 꼬리질문 최대 1회)
        return {
            "needs_follow_up": False,
            "reason": "모든 채점 기준 항목에 대해 이미 꼬리질문이 1회씩 출제되었으므로 추가 라운드를 진행하지 않습니다.",
            "request_to_generator": "",
            "target_rubric_index": None,
            "target_rubric_description": "",
        }
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
            used_rubric_indices=sorted(used_set),
        ),
        JudgeAnswerSchema,
        max_tokens=1200,
    )
    reason = result.reason.strip()
    request_to_generator = result.request_to_generator.strip()
    target_index = result.target_rubric_index
    target_description = result.target_rubric_description.strip()
    if result.needs_follow_up:
        if not request_to_generator:
            raise RuntimeError(
                "평가관이 꼬리질문 필요 판단을 했지만 생성기 요청이 비어 있습니다."
            )
        if target_index is None:
            raise RuntimeError(
                "평가관이 꼬리질문 필요 판단을 했지만 target_rubric_index가 비어 있습니다."
            )
        if target_index < 0 or target_index >= rubric_size:
            raise RuntimeError(
                "평가관이 반환한 target_rubric_index가 채점 기준표 범위를 벗어났습니다: "
                f"index={target_index}, rubric_size={rubric_size}"
            )
        if target_index in used_set:
            raise RuntimeError(
                "Judge가 이미 꼬리질문이 출제된 rubric index를 다시 선택했습니다. "
                f"selected={target_index}, used={sorted(used_set)}. 정책 위반 — 우회하지 말고 원인을 추적하세요."
            )
        if not target_description:
            raise RuntimeError(
                "평가관이 target_rubric_index만 지정하고 target_rubric_description을 비워 두었습니다."
            )
    else:
        if request_to_generator:
            raise RuntimeError(
                "평가관이 꼬리질문 불필요 판단을 했지만 생성기 요청을 함께 반환했습니다."
            )
        if target_index is not None or target_description:
            raise RuntimeError(
                "평가관이 꼬리질문 불필요 판단을 했지만 target_rubric_* 값이 채워져 있습니다."
            )
    return {
        "needs_follow_up": result.needs_follow_up,
        "reason": reason,
        "request_to_generator": request_to_generator,
        "target_rubric_index": target_index,
        "target_rubric_description": target_description,
    }


def generate_follow_up_question(
    question: InterviewQuestionRow,
    answer_text: str,
    judge_reason: str,
    request_to_generator: str,
    target_rubric_index: int,
    target_rubric_description: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
) -> str:
    if llm is None or not llm.enabled():
        raise RuntimeError(
            "꼬리질문 생성에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    if target_rubric_index < 0 or target_rubric_index >= len(scoring_rubric):
        raise RuntimeError(
            "꼬리질문 생성 요청의 target_rubric_index가 채점 기준표 범위를 벗어났습니다: "
            f"index={target_rubric_index}, rubric_size={len(scoring_rubric)}"
        )
    if not target_rubric_description.strip():
        raise RuntimeError("꼬리질문 생성 요청의 target_rubric_description이 비어 있습니다.")
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
            target_rubric_index=target_rubric_index,
            target_rubric_description=target_rubric_description,
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
        "weaknesses": list(result.weaknesses),
        "strengths": list(result.strengths),
    }


def evaluate_answer(
    question: InterviewQuestionRow,
    answer_text: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
    follow_up_count: int = 0,
    used_rubric_indices: list[int] | None = None,
) -> dict[str, object]:
    judge_result = judge_answer(
        question,
        answer_text,
        llm=llm,
        conversation_history=conversation_history,
        follow_up_count=follow_up_count,
        used_rubric_indices=used_rubric_indices,
    )
    if judge_result["needs_follow_up"]:
        target_index = judge_result["target_rubric_index"]
        target_description = str(judge_result["target_rubric_description"])
        if target_index is None:
            raise RuntimeError(
                "judge_answer 결과 needs_follow_up=true 이지만 target_rubric_index가 None 입니다."
            )
        follow_up_question = generate_follow_up_question(
            question,
            answer_text,
            judge_reason=str(judge_result["reason"]),
            request_to_generator=str(judge_result["request_to_generator"]),
            target_rubric_index=int(target_index),
            target_rubric_description=target_description,
            llm=llm,
            conversation_history=conversation_history,
        )
        return {
            "needs_follow_up": True,
            "follow_up_reason": str(judge_result["reason"]),
            "follow_up_question": follow_up_question,
            "target_rubric_index": int(target_index),
            "target_rubric_description": target_description,
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
        "target_rubric_index": None,
        "target_rubric_description": "",
        **finalized,
    }
