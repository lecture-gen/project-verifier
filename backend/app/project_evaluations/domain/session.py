from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.enums import InterviewSessionStatus
from app.project_evaluations.domain.evaluation import ProjectEvaluationRead


class InterviewSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    participant_name: str = ""
    session_token: str = Field(default="", repr=False)
    status: InterviewSessionStatus
    current_question_index: int
    created_at: datetime
    completed_at: datetime | None = None


class AdminVerifyRequest(BaseModel):
    admin_password: str = Field(min_length=1, max_length=200, repr=False)


class AdminVerifyRead(BaseModel):
    ok: bool


class JoinEvaluationRequest(BaseModel):
    participant_name: str = Field(min_length=1, max_length=200)
    room_password: str = Field(min_length=1, max_length=200, repr=False)


class JoinEvaluationRead(BaseModel):
    evaluation: ProjectEvaluationRead
    session: InterviewSessionRead
    interview_url_path: str
