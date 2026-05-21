from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.enums import QualitativeGrade


class ProjectQualityAssessmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    qualitative_grade: QualitativeGrade
    quantitative_score: float = Field(ge=0.0, le=100.0)
    workload_baseline: str
    summary: str
    strengths: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    rationale: str
    evidence_refs: list[str] = Field(default_factory=list)
    model_name: str
    created_at: datetime
