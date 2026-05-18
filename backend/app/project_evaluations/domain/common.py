from pydantic import BaseModel, Field


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
    """문제별 LLM 생성 채점 기준 한 항목에 대한 채점 결과."""

    criterion: str
    criterion_index: int = Field(ge=0)
    score: int = Field(ge=0)
    max_points: int = Field(ge=1)
    rationale: str = ""


class FollowUpExchange(BaseModel):
    question: str
    answer: str
    reason: str = ""


class QuestionExchange(BaseModel):
    student_answer: str
    follow_ups: list[FollowUpExchange] = Field(default_factory=list)
