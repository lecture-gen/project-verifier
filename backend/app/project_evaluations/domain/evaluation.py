from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.bloom import QuestionGenerationPolicy
from app.project_evaluations.domain.enums import EvaluationStatus


class ProjectEvaluationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    room_password: str = Field(default="", max_length=200, repr=False)
    question_policy: QuestionGenerationPolicy = Field(
        default_factory=QuestionGenerationPolicy
    )


class ProjectEvaluationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: EvaluationStatus
    question_policy: QuestionGenerationPolicy
    created_at: datetime
    updated_at: datetime


class ProjectEvaluationSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    status: EvaluationStatus
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
