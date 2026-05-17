from pydantic import BaseModel, Field

from app.project_evaluations.domain.enums import RubricCriterion


class SourceReference(BaseModel):
    path: str
    snippet: str = ""
    artifact_id: str | None = None
    page_or_slide: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    artifact_role: str | None = None
    chunk_type: str | None = None


class RubricScoreItem(BaseModel):
    criterion: RubricCriterion
    score: int = Field(ge=0, le=3)
    rationale: str = ""


class FollowUpExchange(BaseModel):
    question: str
    answer: str
    reason: str = ""


class QuestionExchange(BaseModel):
    student_answer: str
    follow_ups: list[FollowUpExchange] = Field(default_factory=list)
