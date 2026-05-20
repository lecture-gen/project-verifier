from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import (
    JudgeAnswerSchema,
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


_SOURCE_SNIPPET_LIMIT = 3
_SOURCE_SNIPPET_CHARS = 200


def _source_snippets(question: InterviewQuestionRow) -> list[str]:
    """R2-C: 평가 콜 입력에 들어가는 source snippet 을 상위 3개·각 200자로 보수적 제한.

    질문 생성 시 source_refs 가 비정상적으로 많이 저장된 케이스에서 input 토큰이
    폭주하는 것을 방지한다. R1 prompt caching prefix 안정화에도 기여한다.
    """

    source_refs = refs_from_json(question.source_refs_json)
    if not source_refs:
        raise RuntimeError("답변 평가에 사용할 question source refs가 없습니다.")
    snippets: list[str] = []
    for ref in source_refs:
        snippet = (ref.snippet or "").strip()
        if not snippet:
            continue
        if len(snippet) > _SOURCE_SNIPPET_CHARS:
            snippet = snippet[:_SOURCE_SNIPPET_CHARS].rstrip() + "…"
        snippets.append(f"{ref.path}: {snippet}")
        if len(snippets) >= _SOURCE_SNIPPET_LIMIT:
            break
    if not snippets:
        raise RuntimeError("답변 평가에 사용할 question source snippets가 비어 있습니다.")
    return snippets


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
    project_context_brief: str = "",
    force_finalize: bool = False,
) -> dict[str, object]:
    """R1 통합 호출.

    한 번의 LLM 호출에서 다음을 모두 수행한다.
      - needs_follow_up 판정
      - needs_follow_up=true → follow_up_question 한 문장도 함께 생성
      - needs_follow_up=false → rubric_scores·final_score·evaluation_summary 등 채점 결과도 함께 생성

    force_finalize=True 이면 used_rubric_indices 에 전체 인덱스를 주입해 모델이
    자동으로 needs_follow_up=false 분기를 타도록 유도한다. (강제 finalize 경로)

    반환 dict 는 evaluate_answer 가 그대로 사용 가능한 형태로 정규화한다.
    """

    if llm is None or not llm.enabled():
        raise RuntimeError(
            "답변 평가에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요."
        )
    scoring_rubric = _scoring_rubric_payload(question)
    rubric_size = len(scoring_rubric)
    used_set = {int(i) for i in (used_rubric_indices or []) if i is not None}
    if force_finalize:
        # 모든 rubric 이 이미 출제된 것으로 표기 → JUDGE_INTEGRATED_SYSTEM 의
        # "미사용 항목이 0개이면 needs_follow_up=false 로 종료" 규약이 적용된다.
        used_set = {i for i in range(rubric_size)}
    available_indices = [i for i in range(rubric_size) if i not in used_set]
    if not available_indices:
        # 모든 채점 기준 항목이 이미 한 번씩 출제됨 → 더 이상 꼬리질문할 수 있는 항목이 없으므로
        # LLM 통합 호출 없이도 needs_follow_up=false 가 확정. 단, 채점은 LLM 호출로 받아야 하므로
        # build_judge_prompt 에 used_set 전체를 넘겨 모델이 자동으로 false 분기를 타도록 한다.
        # (별도 단축 경로를 만들면 finalize 도 별도 콜이 되어 R1 통합 목적에 어긋남.)
        pass

    expected_signature = _expected_rubric_signature(scoring_rubric)
    expected_max = sum(int(item["points"]) for item in scoring_rubric)
    cache_key = f"judge:{question.evaluation_id}:{question.id}"
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
            project_context_brief=project_context_brief,
        ),
        JudgeAnswerSchema,
        # 통합 호출이므로 두 분기 중 채점 분기 (rubric_scores 전체 + 6개 리스트 + summary) 가
        # 들어갈 최대 크기에 맞춰 늘린다. 기존 finalize 의 max_tokens=2000 기반.
        max_tokens=2400,
        cache_key=cache_key,
    )
    reason = result.reason.strip()

    if result.needs_follow_up:
        request_to_generator = result.request_to_generator.strip()
        target_index = result.target_rubric_index
        target_description = result.target_rubric_description.strip()
        follow_up_question = result.follow_up_question.strip()
        if not request_to_generator:
            raise RuntimeError(
                "평가관이 꼬리질문 필요 판단을 했지만 request_to_generator가 비어 있습니다."
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
        if not follow_up_question:
            raise RuntimeError(
                "R1 통합 호출에서 needs_follow_up=true 이지만 follow_up_question 이 비어 있습니다. "
                "프롬프트 정책 위반 — 우회하지 말고 원인을 추적하세요."
            )
        return {
            "needs_follow_up": True,
            "reason": reason,
            "request_to_generator": request_to_generator,
            "target_rubric_index": int(target_index),
            "target_rubric_description": target_description,
            "follow_up_question": follow_up_question,
        }

    # needs_follow_up=false → 같은 호출에서 받은 채점 결과를 검증·정규화.
    if result.request_to_generator.strip():
        raise RuntimeError(
            "평가관이 꼬리질문 불필요 판단을 했지만 request_to_generator를 함께 반환했습니다."
        )
    if result.target_rubric_index is not None or result.target_rubric_description.strip():
        raise RuntimeError(
            "평가관이 꼬리질문 불필요 판단을 했지만 target_rubric_* 값이 채워져 있습니다."
        )
    if result.follow_up_question.strip():
        raise RuntimeError(
            "평가관이 꼬리질문 불필요 판단을 했지만 follow_up_question을 함께 반환했습니다."
        )
    if result.final_score is None:
        raise RuntimeError(
            "R1 통합 호출에서 needs_follow_up=false 이지만 final_score 가 None 입니다."
        )
    if not result.evaluation_summary.strip():
        raise RuntimeError(
            "R1 통합 호출에서 needs_follow_up=false 이지만 evaluation_summary 가 비어 있습니다."
        )
    if not result.rubric_scores:
        raise RuntimeError(
            "R1 통합 호출에서 needs_follow_up=false 이지만 rubric_scores 가 비어 있습니다."
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
    final_score = float(result.final_score)
    if final_score < 0 or final_score > expected_max:
        raise RuntimeError(
            f"통합 호출에서 final_score 가 채점 기준 전체 만점 범위를 벗어났습니다: "
            f"final_score={final_score}, max={expected_max}"
        )
    _validate_rubric_scores(expected_signature, rubric_scores, final_score)

    return {
        "needs_follow_up": False,
        "reason": reason,
        "request_to_generator": "",
        "target_rubric_index": None,
        "target_rubric_description": "",
        "follow_up_question": "",
        "score": final_score,
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


def generate_follow_up_question(*args: object, **kwargs: object) -> str:
    """R1 통합 이후로는 judge_answer 단일 호출이 follow_up_question 까지 같이 만든다.

    이 함수가 다시 호출되면 별도 LLM 콜이 발생해 비용 절감 목적을 깨므로 즉시 raise.
    우회하지 말고 호출 측을 judge_answer 결과의 follow_up_question 으로 교체해야 한다.
    """

    raise RuntimeError(
        "generate_follow_up_question 단독 호출은 R1 통합으로 더 이상 지원되지 않습니다. "
        "judge_answer / evaluate_answer 의 통합 응답을 사용하세요."
    )


def finalize_oral_evaluation(*args: object, **kwargs: object) -> dict[str, object]:
    """R1 통합 이후로는 judge_answer 단일 호출이 최종 채점(final_score 등)까지 같이 수행한다.

    이 함수가 다시 호출되면 별도 LLM 콜이 발생해 비용 절감 목적을 깨므로 즉시 raise.
    """

    raise RuntimeError(
        "finalize_oral_evaluation 단독 호출은 R1 통합으로 더 이상 지원되지 않습니다. "
        "judge_answer / evaluate_answer 의 통합 응답을 사용하세요."
    )


def evaluate_answer(
    question: InterviewQuestionRow,
    answer_text: str,
    llm: LlmClient | None = None,
    conversation_history: str = "",
    follow_up_count: int = 0,
    used_rubric_indices: list[int] | None = None,
    project_context_brief: str = "",
    force_finalize: bool = False,
) -> dict[str, object]:
    judge_result = judge_answer(
        question,
        answer_text,
        llm=llm,
        conversation_history=conversation_history,
        follow_up_count=follow_up_count,
        used_rubric_indices=used_rubric_indices,
        project_context_brief=project_context_brief,
        force_finalize=force_finalize,
    )
    if force_finalize and judge_result["needs_follow_up"]:
        # force_finalize=True 인데도 모델이 needs_follow_up=true 를 반환한 경우는
        # 프롬프트 정책 위반이다. 우회하지 말고 사용자에게 알리기 위해 raise.
        raise RuntimeError(
            "force_finalize=True 인데도 LLM이 needs_follow_up=true 를 반환했습니다. "
            "JUDGE_INTEGRATED_SYSTEM 의 미사용 항목 규약 위반 — 우회하지 말고 원인을 추적하세요."
        )
    if judge_result["needs_follow_up"]:
        return {
            "needs_follow_up": True,
            "follow_up_reason": str(judge_result["reason"]),
            "follow_up_question": str(judge_result["follow_up_question"]),
            "target_rubric_index": int(judge_result["target_rubric_index"]),  # type: ignore[arg-type]
            "target_rubric_description": str(judge_result["target_rubric_description"]),
        }
    return {
        "needs_follow_up": False,
        "follow_up_reason": "",
        "follow_up_question": None,
        "target_rubric_index": None,
        "target_rubric_description": "",
        "score": float(judge_result["score"]),  # type: ignore[arg-type]
        "evaluation_summary": str(judge_result["evaluation_summary"]),
        "rubric_scores": list(judge_result["rubric_scores"]),  # type: ignore[arg-type]
        "evidence_matches": list(judge_result["evidence_matches"]),  # type: ignore[arg-type]
        "evidence_mismatches": list(judge_result["evidence_mismatches"]),  # type: ignore[arg-type]
        "weaknesses": list(judge_result["weaknesses"]),  # type: ignore[arg-type]
        "strengths": list(judge_result["strengths"]),  # type: ignore[arg-type]
    }
