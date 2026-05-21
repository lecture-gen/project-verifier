from __future__ import annotations

from typing import Any

from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import (
    ProjectQualityAssessmentSchema,
    build_quality_prompt,
)
from app.project_evaluations.domain.enums import PROJECT_CATEGORY_KO_LABEL


def _evaluation_coordinates_payload(
    name: str,
    project_category: str,
    period_start: Any,
    period_end: Any,
    expected_participant_count: int | None,
    focus_points: str,
) -> dict[str, Any]:
    return {
        "name": name,
        "project_category": project_category,
        "project_category_ko": PROJECT_CATEGORY_KO_LABEL.get(
            project_category, project_category
        ),
        "evaluation_period_start": period_start.isoformat() if period_start else None,
        "evaluation_period_end": period_end.isoformat() if period_end else None,
        "expected_participant_count": expected_participant_count,
        "focus_points": focus_points or "",
    }


def run_quality_assessment(
    llm: LlmClient,
    *,
    name: str,
    project_category: str,
    period_start: Any,
    period_end: Any,
    expected_participant_count: int | None,
    focus_points: str,
    structural_facts: dict[str, Any] | None,
    extracted_context: dict[str, Any],
    cache_key: str | None = None,
) -> ProjectQualityAssessmentSchema:
    if not llm.enabled():
        raise RuntimeError(
            "프로젝트 품질 평가용 LLM 클라이언트가 비활성화되었습니다 (OPENAI_API_KEY 누락)."
        )
    coordinates = _evaluation_coordinates_payload(
        name=name,
        project_category=project_category,
        period_start=period_start,
        period_end=period_end,
        expected_participant_count=expected_participant_count,
        focus_points=focus_points,
    )
    messages = build_quality_prompt(
        evaluation_coordinates=coordinates,
        structural_facts=structural_facts,
        extracted_context=extracted_context,
    )
    parsed: ProjectQualityAssessmentSchema = llm.parse(
        messages=messages,
        schema=ProjectQualityAssessmentSchema,
        temperature=0.2,
        max_tokens=2000,
        cache_key=cache_key,
    )
    return parsed
