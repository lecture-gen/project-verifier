from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.project_evaluations.domain.common import SourceReference
from app.project_evaluations.domain.enums import ArtifactSourceType, ArtifactStatus


class ProjectArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    source_path: str
    source_type: ArtifactSourceType
    status: ArtifactStatus
    char_count: int
    text_preview: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ArtifactUploadResult(BaseModel):
    evaluation_id: str
    accepted_count: int
    skipped_count: int
    ignored_count: int = 0
    empty_text_count: int = 0
    file_too_large_count: int = 0
    processed_file_limit_count: int = 0
    failed_count: int = 0
    reason_counts: dict[str, int] = Field(default_factory=dict)
    processing_limits: dict[str, int] = Field(default_factory=dict)
    supported_extensions: list[str] = Field(default_factory=list)
    artifacts: list[ProjectArtifactRead]


class ProjectAreaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    name: str
    summary: str
    confidence: float
    source_refs: list[SourceReference] = Field(default_factory=list)


class ExtractedProjectContextRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    summary: str
    tech_stack: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    architecture_notes: list[str] = Field(default_factory=list)
    data_flow: list[str] = Field(default_factory=list)
    risk_points: list[str] = Field(default_factory=list)
    question_targets: list[str] = Field(default_factory=list)
    rag_status: dict[str, Any] = Field(default_factory=dict)
    areas: list[ProjectAreaRead] = Field(default_factory=list)
    created_at: datetime
