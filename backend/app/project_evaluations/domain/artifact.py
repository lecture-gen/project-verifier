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
    role_in_project: str = ""
    key_concerns: list[str] = Field(default_factory=list)
    source_refs: list[SourceReference] = Field(default_factory=list)


class TechStackItemRead(BaseModel):
    name: str
    category: str
    role_in_project: str
    evidence_path: str = ""


class ArchitectureNodeRead(BaseModel):
    id: str
    label: str
    layer: str


class ArchitectureEdgeRead(BaseModel):
    source: str
    target: str
    label: str = ""


class ArchitectureRead(BaseModel):
    style: str = ""
    summary: str = ""
    layers: list[str] = Field(default_factory=list)
    modules: list[str] = Field(default_factory=list)
    nodes: list[ArchitectureNodeRead] = Field(default_factory=list)
    edges: list[ArchitectureEdgeRead] = Field(default_factory=list)


class StudentImplementationRiskRead(BaseModel):
    area: str
    challenge: str
    why_difficult: str
    evidence_path: str = ""


class StructuralFactsRead(BaseModel):
    file_count: int = 0
    code_file_count: int = 0
    doc_file_count: int = 0
    total_loc: int = 0
    test_ratio: float = 0.0
    language_loc: list[dict[str, Any]] = Field(default_factory=list)
    file_tree: list[dict[str, Any]] = Field(default_factory=list)
    dependencies: list[dict[str, Any]] = Field(default_factory=list)
    entry_point_candidates: list[str] = Field(default_factory=list)
    readme_outline: list[dict[str, Any]] = Field(default_factory=list)


class ExtractedProjectContextRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    evaluation_id: str
    summary: str
    tech_stack: list[TechStackItemRead] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    architecture: ArchitectureRead = Field(default_factory=ArchitectureRead)
    student_implementation_risks: list[StudentImplementationRiskRead] = Field(
        default_factory=list
    )
    structural_facts: StructuralFactsRead = Field(default_factory=StructuralFactsRead)
    question_targets: list[str] = Field(default_factory=list)
    rag_status: dict[str, Any] = Field(default_factory=dict)
    areas: list[ProjectAreaRead] = Field(default_factory=list)
    created_at: datetime
