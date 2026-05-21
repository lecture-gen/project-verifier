from enum import StrEnum


class EvaluationStatus(StrEnum):
    CREATED = "created"
    UPLOADED = "uploaded"
    ANALYZED = "analyzed"
    QUESTIONS_GENERATED = "questions_generated"
    INTERVIEWING = "interviewing"
    REPORTED = "reported"


class ArtifactSourceType(StrEnum):
    ZIP = "zip"
    DOCUMENT = "document"
    CODE = "code"
    TEXT = "text"
    IGNORED = "ignored"


class ArtifactRole(StrEnum):
    CODEBASE_SOURCE = "codebase_source"
    CODEBASE_TEST = "codebase_test"
    CODEBASE_CONFIG = "codebase_config"
    CODEBASE_API_SPEC = "codebase_api_spec"
    CODEBASE_OVERVIEW = "codebase_overview"
    PROJECT_REPORT = "project_report"
    PROJECT_PRESENTATION = "project_presentation"
    PROJECT_DESIGN_DOC = "project_design_doc"
    PROJECT_DESCRIPTION = "project_description"
    IGNORED = "ignored"


class ArtifactStatus(StrEnum):
    EXTRACTED = "extracted"
    SKIPPED = "skipped"
    FAILED = "failed"


class InterviewSessionStatus(StrEnum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class FinalDecision(StrEnum):
    VERIFIED = "검증 통과"
    NEEDS_FOLLOWUP = "추가 확인 필요"
    LOW_CONFIDENCE = "신뢰 낮음"


class ProjectCategory(StrEnum):
    WEEKLY = "weekly"
    MIDTERM = "midterm"
    FINAL = "final"
    CAPSTONE_FINAL = "capstone_final"


PROJECT_CATEGORY_KO_LABEL: dict[str, str] = {
    ProjectCategory.WEEKLY.value: "주간 과제",
    ProjectCategory.MIDTERM.value: "중간 과제",
    ProjectCategory.FINAL.value: "기말 과제",
    ProjectCategory.CAPSTONE_FINAL.value: "최종 과제",
}


class QualitativeGrade(StrEnum):
    EXCELLENT = "excellent"
    GOOD = "good"
    MEDIOCRE = "mediocre"
    POOR = "poor"


class BloomLevel(StrEnum):
    REMEMBER = "기억"
    UNDERSTAND = "이해"
    APPLY = "적용"
    ANALYZE = "분석"
    EVALUATE = "평가"
    CREATE = "창안"


class InterviewTurnMode(StrEnum):
    ANSWER = "answer"
    FOLLOW_UP = "follow_up"
    END = "end"


class InterviewTurnFlowStatus(StrEnum):
    NEED_FOLLOW_UP = "need_follow_up"
    TURN_SUBMITTED = "turn_submitted"
    READY_TO_COMPLETE = "ready_to_complete"
    COMPLETED = "completed"


BLOOM_ORDER = [
    BloomLevel.REMEMBER,
    BloomLevel.UNDERSTAND,
    BloomLevel.APPLY,
    BloomLevel.ANALYZE,
    BloomLevel.EVALUATE,
    BloomLevel.CREATE,
]
DEFAULT_BLOOM_RATIOS = {level.value: 1 for level in BLOOM_ORDER}
DEFAULT_TOTAL_QUESTION_COUNT = len(BLOOM_ORDER)
MAX_BLOOM_RATIO = 10
