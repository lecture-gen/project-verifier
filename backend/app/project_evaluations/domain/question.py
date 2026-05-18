from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.common import SourceReference
from app.project_evaluations.domain.enums import (
    BloomLevel,
    Difficulty,
    RubricCriterion,
)


class InterviewQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    project_area_id: str | None
    question: str
    intent: str
    bloom_level: BloomLevel
    difficulty: Difficulty
    rubric_criteria: list[RubricCriterion]
    evaluation_targets: list[str] = Field(default_factory=list)
    source_refs: list[SourceReference] = Field(default_factory=list)
    expected_signal: str
    verification_focus: str = ""
    expected_evidence: str = ""
    source_ref_requirements: str = ""
    order_index: int
    created_at: datetime
