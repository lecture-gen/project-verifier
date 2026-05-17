from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.enums import FinalDecision


class EvaluationReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    session_id: str
    final_decision: FinalDecision
    authenticity_score: float
    summary: str
    area_analyses: list[dict[str, Any]] = Field(default_factory=list)
    question_evaluations: list[dict[str, Any]] = Field(default_factory=list)
    bloom_summary: list[dict[str, Any]] = Field(default_factory=list)
    rubric_summary: list[dict[str, Any]] = Field(default_factory=list)
    evidence_alignment: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    suspicious_points: list[str] = Field(default_factory=list)
    recommended_followups: list[str] = Field(default_factory=list)
    created_at: datetime
