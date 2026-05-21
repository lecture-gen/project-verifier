from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.bloom import QuestionGenerationPolicy
from app.project_evaluations.domain.enums import EvaluationStatus, ProjectCategory


class ProjectEvaluationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    question_policy: QuestionGenerationPolicy = Field(
        default_factory=QuestionGenerationPolicy
    )
    evaluation_period_start: datetime | None = None
    evaluation_period_end: datetime | None = None
    expected_participant_count: int | None = Field(default=None, ge=1, le=500)
    project_category: ProjectCategory = ProjectCategory.WEEKLY
    focus_points: str = Field(default="", max_length=2000)


class ProjectEvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: EvaluationStatus
    question_policy: QuestionGenerationPolicy
    evaluation_period_start: datetime | None = None
    evaluation_period_end: datetime | None = None
    expected_participant_count: int | None = None
    project_category: ProjectCategory = ProjectCategory.WEEKLY
    focus_points: str = ""
    created_at: datetime
    updated_at: datetime


class ProjectEvaluationSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: EvaluationStatus
    project_category: ProjectCategory = ProjectCategory.WEEKLY
    question_count: int
    created_at: datetime
    updated_at: datetime


class QuestionPolicyUpdate(BaseModel):
    question_policy: QuestionGenerationPolicy


class ProjectEvaluationStatusRead(BaseModel):
    evaluation_id: str
    status: str
    phase: str
    has_artifacts: bool
    has_context: bool
    has_quality_assessment: bool = False
    rag_status: dict[str, Any] = Field(default_factory=dict)
    question_count: int
    expected_question_count: int
    questions_ready: bool
    can_generate_questions: bool
    can_join: bool
    blocked_reason: str = ""
    user_message: str
    check_targets: list[str] = Field(default_factory=list)
    retryable: bool = False
