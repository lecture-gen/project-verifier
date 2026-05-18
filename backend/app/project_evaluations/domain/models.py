"""Backward-compatible re-exports for the previously single ``models`` module.

The original ``models.py`` was split into topic-specific modules under
``app.project_evaluations.domain``. Importing from this module keeps existing
callers working while new code should import directly from the topic modules.
"""

from app.project_evaluations.domain.artifact import (
    ArchitectureEdgeRead,
    ArchitectureNodeRead,
    ArchitectureRead,
    ArtifactUploadResult,
    ExtractedProjectContextRead,
    ProjectAreaRead,
    ProjectArtifactRead,
    StructuralFactsRead,
    StudentImplementationRiskRead,
    TechStackItemRead,
)
from app.project_evaluations.domain.bloom import (
    QuestionGenerationPolicy,
    _normalize_bloom_ratios,
    distribute_bloom_questions,
    normalize_bloom_level,
)
from app.project_evaluations.domain.common import (
    FollowUpExchange,
    QuestionExchange,
    RubricScoreItem,
    SourceReference,
)
from app.project_evaluations.domain.enums import (
    BLOOM_ORDER,
    DEFAULT_BLOOM_RATIOS,
    DEFAULT_TOTAL_QUESTION_COUNT,
    MAX_BLOOM_RATIO,
    ArtifactRole,
    ArtifactSourceType,
    ArtifactStatus,
    BloomLevel,
    EvaluationStatus,
    FinalDecision,
    InterviewSessionStatus,
    InterviewTurnFlowStatus,
    InterviewTurnMode,
)
from app.project_evaluations.domain.evaluation import (
    ProjectEvaluationCreate,
    ProjectEvaluationRead,
    ProjectEvaluationStatusRead,
    ProjectEvaluationSummaryRead,
    QuestionPolicyUpdate,
)
from app.project_evaluations.domain.interview import (
    InterviewTranscriptionRead,
    InterviewTurnCreate,
    InterviewTurnFlowRequest,
    InterviewTurnFlowResponse,
    InterviewTurnRead,
    StudentInterviewStateRead,
)
from app.project_evaluations.domain.question import (
    InterviewQuestionRead,
    ScoringRubricItem,
)
from app.project_evaluations.domain.report import EvaluationReportRead
from app.project_evaluations.domain.session import (
    InterviewSessionRead,
    JoinEvaluationRead,
    JoinEvaluationRequest,
)

__all__ = [
    "ArchitectureEdgeRead",
    "ArchitectureNodeRead",
    "ArchitectureRead",
    "ArtifactRole",
    "ArtifactSourceType",
    "ArtifactStatus",
    "ArtifactUploadResult",
    "BLOOM_ORDER",
    "BloomLevel",
    "DEFAULT_BLOOM_RATIOS",
    "DEFAULT_TOTAL_QUESTION_COUNT",
    "EvaluationReportRead",
    "EvaluationStatus",
    "ExtractedProjectContextRead",
    "FinalDecision",
    "FollowUpExchange",
    "InterviewQuestionRead",
    "InterviewSessionRead",
    "InterviewSessionStatus",
    "InterviewTranscriptionRead",
    "InterviewTurnCreate",
    "InterviewTurnFlowRequest",
    "InterviewTurnFlowResponse",
    "InterviewTurnFlowStatus",
    "InterviewTurnMode",
    "InterviewTurnRead",
    "JoinEvaluationRead",
    "JoinEvaluationRequest",
    "MAX_BLOOM_RATIO",
    "ProjectAreaRead",
    "ProjectArtifactRead",
    "ProjectEvaluationCreate",
    "ProjectEvaluationRead",
    "ProjectEvaluationStatusRead",
    "ProjectEvaluationSummaryRead",
    "QuestionExchange",
    "QuestionGenerationPolicy",
    "QuestionPolicyUpdate",
    "RubricScoreItem",
    "ScoringRubricItem",
    "SourceReference",
    "StructuralFactsRead",
    "StudentImplementationRiskRead",
    "StudentInterviewStateRead",
    "TechStackItemRead",
    "_normalize_bloom_ratios",
    "distribute_bloom_questions",
    "normalize_bloom_level",
]
