from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.common import (
    QuestionExchange,
    RubricScoreItem,
)
from app.project_evaluations.domain.enums import (
    InterviewTurnFlowStatus,
    InterviewTurnMode,
)
from app.project_evaluations.domain.question import InterviewQuestionRead
from app.project_evaluations.domain.report import EvaluationReportRead


class InterviewTurnCreate(BaseModel):
    question_id: str
    answer_text: str = Field(min_length=1, max_length=10000)


class InterviewTranscriptionRead(BaseModel):
    transcript: str
    mode: InterviewTurnMode


class InterviewTurnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    session_id: str
    question_id: str
    question_text: str
    answer_text: str
    score: float
    evaluation_summary: str
    rubric_scores: list[RubricScoreItem] = Field(default_factory=list)
    evidence_matches: list[str] = Field(default_factory=list)
    evidence_mismatches: list[str] = Field(default_factory=list)
    suspicious_points: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None
    follow_up_reason: str = ""
    finalized_score: float | None = None
    conversation_history: QuestionExchange | None = None
    created_at: datetime


class StudentInterviewStateRead(BaseModel):
    session_id: str
    current_question_index: int
    total_questions: int
    question: InterviewQuestionRead | None = None
    turns: list[InterviewTurnRead] = Field(default_factory=list)
    is_completed: bool = False


class InterviewTurnFlowRequest(BaseModel):
    mode: InterviewTurnMode = InterviewTurnMode.ANSWER
    answer_text: str = Field(default="", max_length=10000)
    draft_answer: str = Field(default="", max_length=20000)
    follow_up_question: str = Field(default="", max_length=2000)
    follow_up_reason: str = Field(default="", max_length=4000)
    current_question_id: str | None = None


class InterviewTurnFlowResponse(BaseModel):
    status: InterviewTurnFlowStatus
    message: str
    draft_answer: str = ""
    follow_up_question: str | None = None
    follow_up_reason: str = ""
    next_mode: InterviewTurnMode | None = None
    turn: InterviewTurnRead | None = None
    next_question: InterviewQuestionRead | None = None
    report: EvaluationReportRead | None = None
