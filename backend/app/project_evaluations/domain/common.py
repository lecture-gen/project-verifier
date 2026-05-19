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
    # 이 꼬리질문이 어떤 채점 기준(rubric index)을 보충하려 했는지 기록한다.
    # 같은 항목이 한 세션에서 두 번 꼬리질문되지 않게 하기 위한 핵심 데이터.
    # 학생이 답하지 못한(SKIP) 라운드여도 채워 둔다 → 다음 라운드 used 집합 계산에 사용.
    target_rubric_index: int | None = None


class QuestionExchange(BaseModel):
    student_answer: str
    follow_ups: list[FollowUpExchange] = Field(default_factory=list)
