from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.common import SourceReference
from app.project_evaluations.domain.enums import BloomLevel


class ScoringRubricItem(BaseModel):
    description: str
    points: int = Field(ge=1)


class InterviewQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    project_area_id: str | None
    question: str
    intent: str
    bloom_level: BloomLevel
    expected_answer: str
    scoring_rubric: list[ScoringRubricItem] = Field(default_factory=list)
    max_points: int
    source_refs: list[SourceReference] = Field(default_factory=list)
    order_index: int
    created_at: datetime
