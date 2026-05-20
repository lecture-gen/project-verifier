import json
import math
from collections import Counter
from pathlib import PurePosixPath

from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import (
    ProjectContextSchema,
    build_context_prompt,
)
from app.project_evaluations.persistence.models import ProjectArtifactRow
from app.project_evaluations.rag.chunk_models import ChunkRecord
from app.project_evaluations.rag.redaction import redact_sensitive_text
from app.project_evaluations.rag.splitters import split_artifact

ROOT_DOC_NAMES = {
    "claude.md",
    "readme.md",
    "pyproject.toml",
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "requirements.txt",
}

def build_project_context(
    artifacts: list[ProjectArtifactRow],
    llm: LlmClient | None = None,
    cache_key: str | None = None,
) -> dict[str, object]:
    extracted = [a for a in artifacts if a.raw_text.strip()]
    if llm is None or not llm.enabled():
        raise RuntimeError("프로젝트 context 생성에 필요한 LLM client가 비활성화되었습니다. OPENAI_API_KEY와 분석 모델 설정을 확인하세요.")
    return _build_with_llm(extracted, llm, cache_key=cache_key)


def _build_with_llm(
    artifacts: list[ProjectArtifactRow],
    llm: LlmClient,
    cache_key: str | None = None,
) -> dict[str, object]:
    from app.project_evaluations.analysis.structural_extractor import (
        extract_structural_facts,
    )

    # R2-A 보수적: 분석 청크 수를 artifact 규모에 비례해 자동 산정한다.
    # 큰 zip(추출 텍스트 artifact ≥ 16)은 기존 24 그대로, 작은 zip 은 비례 축소(최소 8).
    # 청크 본문 1500자 컷은 _format_context_chunk 에서 유지 — 코드 함수 본문 손실 방지.
    effective_max = min(24, max(8, math.ceil(len(artifacts) / 2)))
    snippets = _representative_snippets(artifacts, max_snippets=effective_max)
    structural_facts = extract_structural_facts(artifacts)
    messages = build_context_prompt(snippets, structural_facts=structural_facts)
    result: ProjectContextSchema = llm.parse(
        messages, ProjectContextSchema, max_tokens=6000, cache_key=cache_key
    )
    areas = [
        {
            "name": area.name,
            "summary": area.summary,
            "role_in_project": area.role_in_project,
            "key_concerns": list(area.key_concerns),
            "source_refs": _match_source_refs(area.name, artifacts)
            or _representative_source_refs(artifacts),
        }
        for area in result.areas
    ]
    return {
        "summary": result.summary,
        "tech_stack": [item.model_dump() for item in result.tech_stack],
        "features": list(result.features),
        "architecture": result.architecture.model_dump(),
        "student_implementation_risks": [
            risk.model_dump() for risk in result.student_implementation_risks
        ],
        "question_targets": list(result.question_targets),
        "areas": areas,
        "structural_facts": structural_facts,
    }


def _representative_snippets(
    artifacts: list[ProjectArtifactRow], max_snippets: int = 24
) -> list[str]:
    chunks = [
        chunk
        for artifact in _select_representative_artifacts(artifacts, max_items=max_snippets)
        for chunk in split_artifact("context-preview", artifact)
    ]
    selected = _select_representative_chunks(chunks, max_items=max_snippets)
    if not selected:
        raise RuntimeError("프로젝트 context 생성에 사용할 splitter chunk가 없습니다. artifact role 분류와 텍스트 추출 결과를 확인하세요.")
    return [_format_context_chunk(chunk) for chunk in selected]


def _select_representative_chunks(
    chunks: list[ChunkRecord], max_items: int
) -> list[ChunkRecord]:
    # dependency manifest (pyproject.toml / package.json / requirements.txt 등) 의
    # raw 본문은 structural_facts.dependencies 로 이미 parser 가 구조화 데이터를 추출했으므로
    # LLM 입력에 또 보내지 않는다. (안전망: artifact 단계에서 한 번 거른 뒤 chunk 단계에서도 거른다.)
    from app.project_evaluations.analysis.structural_extractor import is_dependency_manifest

    ranked = sorted(chunks, key=_chunk_priority)
    selected: list[ChunkRecord] = []
    role_counts: Counter[str] = Counter()
    path_counts: Counter[str] = Counter()
    for chunk in ranked:
        if is_dependency_manifest(chunk.source_path):
            continue
        if role_counts[chunk.artifact_role] >= 6 or path_counts[chunk.source_path] >= 3:
            continue
        selected.append(chunk)
        role_counts[chunk.artifact_role] += 1
        path_counts[chunk.source_path] += 1
        if len(selected) >= max_items:
            break
    return selected


def _chunk_priority(chunk: ChunkRecord) -> tuple[int, int, str, int]:
    type_priority = {
        "file_manifest": 0,
        "code_symbol": 1,
        "project_document_semantic": 2,
        "codebase_overview": 3,
        "structured_config": 4,
        "code_raw": 5,
    }.get(chunk.chunk_type.value, 6)
    role_priority = {
        "codebase_overview": 0,
        "project_report": 1,
        "project_presentation": 2,
        "project_design_doc": 3,
        "project_description": 4,
        "codebase_source": 5,
        "codebase_test": 6,
        "codebase_api_spec": 7,
        "codebase_config": 8,
    }.get(chunk.artifact_role, 9)
    return (role_priority, type_priority, chunk.source_path, chunk.chunk_index)


def _format_context_chunk(chunk: ChunkRecord) -> str:
    label_parts = [redact_sensitive_text(chunk.source_path)]
    if chunk.line_start is not None and chunk.line_end is not None:
        label_parts.append(f"L{chunk.line_start}-L{chunk.line_end}")
    elif chunk.page_number is not None:
        label_parts.append(f"page {chunk.page_number}")
    elif chunk.slide_number is not None:
        label_parts.append(f"slide {chunk.slide_number}")
    label = ":".join(label_parts)
    return (
        f"[{chunk.artifact_role} | {chunk.chunk_type.value} | {label}]\n"
        f"{redact_sensitive_text(chunk.text)[:1500]}"
    )


def _select_representative_artifacts(
    artifacts: list[ProjectArtifactRow], max_items: int
) -> list[ProjectArtifactRow]:
    # dependency manifest 는 structural_facts.dependencies 로 정형화되므로
    # raw 본문을 LLM 입력 대표 청크 후보로 두지 않는다.
    from app.project_evaluations.analysis.structural_extractor import is_dependency_manifest

    ranked = sorted(artifacts, key=_artifact_priority)
    selected: list[ProjectArtifactRow] = []
    role_counts: Counter[str] = Counter()
    area_counts: Counter[str] = Counter()
    for artifact in ranked:
        if is_dependency_manifest(artifact.source_path):
            continue
        role = _artifact_role(artifact)
        area = _area_name_for_path(artifact.source_path) or "project-docs"
        if role_counts[role] >= 5 or area_counts[area] >= 4:
            continue
        selected.append(artifact)
        role_counts[role] += 1
        area_counts[area] += 1
        if len(selected) >= max_items:
            break
    if len(selected) < min(max_items, len(ranked)):
        seen = {artifact.id for artifact in selected}
        for artifact in ranked:
            if artifact.id in seen:
                continue
            if is_dependency_manifest(artifact.source_path):
                continue
            selected.append(artifact)
            if len(selected) >= max_items:
                break
    return selected


def _artifact_priority(artifact: ProjectArtifactRow) -> tuple[int, str, str]:
    role_priority = {
        "codebase_overview": 0,
        "project_report": 1,
        "project_presentation": 2,
        "project_design_doc": 3,
        "project_description": 4,
        "codebase_source": 5,
        "codebase_test": 6,
        "codebase_api_spec": 7,
        "codebase_config": 8,
    }.get(_artifact_role(artifact), 9)
    return (role_priority, _area_name_for_path(artifact.source_path) or "", artifact.source_path)


def _artifact_role(artifact: ProjectArtifactRow) -> str:
    metadata = _metadata(artifact)
    role = metadata.get("artifact_role")
    return str(role) if role else "unknown"


def _metadata(artifact: ProjectArtifactRow) -> dict[str, object]:
    raw = artifact.metadata_json or "{}"
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _match_source_refs(area_name: str, artifacts: list[ProjectArtifactRow]) -> list[dict]:
    keyword = area_name.lower()
    matched = [
        a
        for a in artifacts
        if keyword in a.source_path.lower() or keyword in a.raw_text.lower()[:500]
    ]
    return _source_refs_for_artifacts(matched[:3])


def _representative_source_refs(artifacts: list[ProjectArtifactRow]) -> list[dict]:
    ranked = sorted(artifacts, key=_source_ref_priority_for_artifact)
    return _source_refs_for_artifacts(ranked[:3])


def _source_refs_for_artifacts(artifacts: list[ProjectArtifactRow]) -> list[dict]:
    return [
        {
            "path": redact_sensitive_text(a.source_path),
            "snippet": redact_sensitive_text(_normalize(a.raw_text))[:240],
            "artifact_id": a.id,
            "artifact_role": _artifact_role(a),
        }
        for a in artifacts
    ]


def _source_ref_priority_for_artifact(artifact: ProjectArtifactRow) -> tuple[int, tuple[int, str], str]:
    return (0 if artifact.source_type == "code" else 1, _source_ref_priority(artifact.source_path), artifact.source_path)


def _area_name_for_path(source_path: str) -> str | None:
    path = PurePosixPath(source_path)
    parts = [part for part in path.parts if part]
    if not parts:
        return None
    if len(parts) == 1 and parts[0].lower() in ROOT_DOC_NAMES:
        return None
    cleaned = parts[1:] if parts[0].lower() in {"tests", "test"} and len(parts) > 1 else parts
    if len(cleaned) >= 3 and cleaned[1].lower() in {"modules", "features", "domains"}:
        return "/".join(cleaned[:3])
    if len(cleaned) >= 2 and cleaned[0].lower() in {"app", "src", "services", "apps"}:
        return "/".join(cleaned[:2])
    if len(cleaned) >= 2:
        return "/".join(cleaned[:2])
    stem = PurePosixPath(cleaned[0]).stem
    return None if stem.lower() in {"claude", "readme", "pyproject"} else stem


def _source_ref_priority(source_path: str) -> tuple[int, str]:
    path = PurePosixPath(source_path)
    is_root_doc = len(path.parts) == 1 and path.name.lower() in ROOT_DOC_NAMES
    return (1 if is_root_doc else 0, source_path)


def _normalize(value: str) -> str:
    return " ".join(value.split())
