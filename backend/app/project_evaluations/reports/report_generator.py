from collections import defaultdict
from typing import Any

from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import ReportSchema, build_report_prompt
from app.project_evaluations.domain.models import FinalDecision
from app.project_evaluations.persistence.models import (
    InterviewQuestionRow,
    InterviewTurnRow,
    ProjectAreaRow,
)
from app.project_evaluations.persistence.repository import from_json


def generate_report_payload(
    areas: list[ProjectAreaRow],
    questions: list[InterviewQuestionRow],
    turns: list[InterviewTurnRow],
    llm: LlmClient | None = None,
    rubric_scores_by_turn: dict[str, list[dict[str, Any]]] | None = None,
    cache_key: str | None = None,
) -> dict[str, Any]:
    if llm is None or not llm.enabled():
        raise RuntimeError("최종 리포트 생성에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 평가 모델 설정을 확인하세요.")
    if not questions:
        raise RuntimeError("최종 리포트 생성에 필요한 검증 질문이 없습니다.")
    if not turns:
        raise RuntimeError("최종 리포트 생성에 필요한 검증 답변이 없습니다.")
    if len(turns) != len(questions):
        raise RuntimeError(
            f"리포트 생성 입력의 질문/답변 수가 일치하지 않습니다. questions={len(questions)}, turns={len(turns)}"
        )

    questions_by_id = {question.id: question for question in questions}
    area_names = {area.id: area.name for area in areas}
    question_evaluations: list[dict[str, Any]] = []
    score_ratio_by_area: dict[str, list[float]] = defaultdict(list)
    score_ratio_by_bloom: dict[str, list[float]] = defaultdict(list)
    bloom_summary_acc: dict[str, dict[str, Any]] = {}
    strengths: list[str] = []
    weaknesses: list[str] = []
    rubric_scores_by_turn = rubric_scores_by_turn or {}

    total_score = 0.0
    total_max_score = 0.0

    for turn in turns:
        question = questions_by_id.get(turn.question_id)
        if question is None:
            raise RuntimeError(f"답변에 연결된 질문을 찾을 수 없습니다. question_id={turn.question_id}")
        area_name = "프로젝트 전체"
        bloom_level = question.bloom_level
        if question.project_area_id:
            area_name = area_names.get(question.project_area_id, area_name)
        max_score = float(question.max_points)
        if max_score <= 0:
            raise RuntimeError(
                f"질문 max_points가 0 이하입니다. question_id={question.id}, max_points={question.max_points}"
            )
        effective_score = float(
            turn.finalized_score if turn.finalized_score is not None else turn.score
        )
        if effective_score < 0 or effective_score > max_score:
            raise RuntimeError(
                f"답변 점수가 만점 범위를 벗어났습니다. turn_id={turn.id}, score={effective_score}, max={max_score}"
            )
        total_score += effective_score
        total_max_score += max_score
        ratio_pct = (effective_score / max_score) * 100.0
        score_ratio_by_area[area_name].append(ratio_pct)
        score_ratio_by_bloom[bloom_level].append(ratio_pct)
        strengths.extend(from_json(turn.strengths_json, []))
        weaknesses.extend(from_json(turn.weaknesses_json, []))
        source_refs = from_json(question.source_refs_json, [])
        if not source_refs:
            raise RuntimeError(f"리포트 입력 질문에 source refs가 없습니다. question_id={question.id}")
        rubric_scores = rubric_scores_by_turn.get(turn.id, [])
        if not rubric_scores:
            raise RuntimeError(f"리포트 입력 답변에 채점 기준표 점수 상세가 없습니다. turn_id={turn.id}")
        rubric_breakdown = [
            {
                "description": str(item.get("criterion", "")),
                "awarded": int(item.get("score", 0)),
                "max_points": int(item.get("max_points", 0)),
                "rationale": str(item.get("rationale", "")),
            }
            for item in sorted(rubric_scores, key=lambda item: int(item.get("criterion_index", 0)))
        ]
        conversation_payload = from_json(turn.conversation_history_json, {})
        follow_up_exchanges = [
            {
                "round": index,
                "question": str(item.get("question", "")).strip(),
                "answer": str(item.get("answer", "")).strip(),
                "reason": str(item.get("reason", "")).strip(),
            }
            for index, item in enumerate(
                conversation_payload.get("follow_ups", []) or [],
                start=1,
            )
        ]
        initial_student_answer = str(
            conversation_payload.get("student_answer", "") or ""
        ).strip()
        question_evaluations.append(
            {
                "question_id": turn.question_id,
                "order_index": question.order_index,
                "question": turn.question_text,
                "answer_preview": turn.answer_text[:500],
                # `student_answer`/`follow_up_exchanges`는 리포트 응답에 결정적으로 그대로 노출된다.
                # LLM은 작성하지 않고, 백엔드가 turn 데이터에서 채워 question_evaluations 후처리에서 머지한다.
                "student_answer": initial_student_answer,
                "follow_up_exchanges": follow_up_exchanges,
                "score": effective_score,
                "max_score": max_score,
                "summary": turn.evaluation_summary,
                "area": area_name,
                "bloom_level": bloom_level,
                "source_refs": source_refs,
                "rubric_breakdown": rubric_breakdown,
            }
        )

    if total_max_score <= 0:
        raise RuntimeError(
            "리포트 생성 시 평가 전체 raw 만점 합이 0 이하입니다. "
            f"total_max_score={total_max_score}. 출제 단계 검증을 확인하세요."
        )

    # 학생 총점은 raw 합을 100점 만점 기준으로 비율 정규화한 값.
    normalized_total_score = round((total_score / total_max_score) * 100.0, 2)

    for bloom_level, values in sorted(score_ratio_by_bloom.items()):
        bloom_summary_acc[bloom_level] = {
            "bloom_level": bloom_level,
            "question_count": len(values),
            "average_score": round(sum(values) / len(values), 2),
        }

    area_source_refs = {
        area.name: from_json(area.source_refs_json, [])
        for area in areas
    }
    area_analyses = [
        {
            "area": area,
            "score_average_pct": round(sum(values) / max(1, len(values)), 2),
            "question_count": len(values),
            "source_refs": area_source_refs.get(area, []),
        }
        for area, values in sorted(score_ratio_by_area.items())
    ]

    raw_total_rounded = round(total_score, 2)
    raw_max_rounded = round(total_max_score, 2)
    report_input = {
        "total_score": normalized_total_score,
        "total_max_score": 100,
        "raw_total_score": raw_total_rounded,
        "raw_total_max_score": raw_max_rounded,
        "area_analyses": area_analyses,
        "question_evaluations": question_evaluations,
        "bloom_summary": list(bloom_summary_acc.values()),
        "strengths": unique(strengths),
        "weaknesses": unique(weaknesses),
    }
    result: ReportSchema = llm.parse(
        build_report_prompt(report_input),
        ReportSchema,
        max_tokens=4000,
        cache_key=cache_key,
    )
    try:
        decision = FinalDecision(result.final_decision)
    except ValueError as exc:
        raise RuntimeError(f"LLM이 지원하지 않는 최종 판정을 반환했습니다: {result.final_decision}") from exc

    # 문제별 student_answer/follow_up_exchanges 는 LLM이 작성하지 않는다.
    # order_index를 키로 백엔드의 결정적 값을 LLM 출력에 머지(=덮어쓰기)한다.
    deterministic_by_order: dict[int, dict[str, Any]] = {
        int(item["order_index"]): item for item in question_evaluations
    }
    merged_question_evaluations: list[dict[str, Any]] = []
    for item in result.question_evaluations:
        dumped = item.model_dump()
        order_index = int(dumped.get("order_index", -1))
        deterministic = deterministic_by_order.get(order_index)
        if deterministic is None:
            raise RuntimeError(
                "리포트 후처리: LLM이 반환한 question_evaluations.order_index에 대응하는 결정적 입력을 찾을 수 없습니다. "
                f"order_index={order_index}. 우회 금지 — 원인을 추적하세요."
            )
        dumped["student_answer"] = str(deterministic.get("student_answer") or "")
        dumped["follow_up_exchanges"] = list(deterministic.get("follow_up_exchanges") or [])
        merged_question_evaluations.append(dumped)

    return {
        "final_decision": decision,
        "authenticity_score": normalized_total_score,
        "total_score": normalized_total_score,
        "total_max_score": 100.0,
        "summary": result.summary,
        "area_analyses": [item.model_dump() for item in result.area_analyses],
        "question_evaluations": merged_question_evaluations,
        "bloom_summary": [item.model_dump() for item in result.bloom_summary],
        "strengths": result.strengths,
        "weaknesses": result.weaknesses,
    }


def unique(items: list[str]) -> list[str]:
    seen = set()
    result = []
    for item in items:
        if item and item not in seen:
            seen.add(item)
            result.append(item)
    return result[:12]
