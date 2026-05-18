from dataclasses import dataclass
from pathlib import PurePosixPath

from app.project_evaluations.domain.models import (
    ArtifactRole,
    ArtifactSourceType,
)

DOCUMENT_EXTENSIONS = {".md", ".txt", ".pdf", ".docx", ".pptx"}
CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".java",
    ".kt",
    ".go",
    ".rs",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".html",
    ".css",
    ".scss",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".sql",
}
CONFIG_FILE_NAMES = {
    # 환경/컨테이너
    ".env.example",
    "docker-compose.yml",
    "docker-compose.yaml",
    # Python
    "pyproject.toml",
    "requirements.txt",
    "pipfile",
    "pipfile.lock",
    "uv.lock",
    # JavaScript / TypeScript
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    # JVM
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    # Go
    "go.mod",
    "go.sum",
    # Rust
    "cargo.toml",
    "cargo.lock",
    # Ruby
    "gemfile",
    "gemfile.lock",
    # PHP
    "composer.json",
    "composer.lock",
}
API_SPEC_NAMES = {
    "api.yaml",
    "api.yml",
    "openapi.json",
    "openapi.yaml",
    "openapi.yml",
    "swagger.json",
    "swagger.yaml",
    "swagger.yml",
}
OVERVIEW_NAMES = {"claude.md", "readme.md"}
TEST_MARKERS = {"test", "tests", "spec", "specs", "__tests__"}
LANGUAGE_BY_EXTENSION = {
    ".c": "c",
    ".cpp": "cpp",
    ".css": "css",
    ".go": "go",
    ".h": "c",
    ".hpp": "cpp",
    ".html": "html",
    ".java": "java",
    ".js": "javascript",
    ".jsx": "javascript",
    ".json": "json",
    ".kt": "kotlin",
    ".py": "python",
    ".rs": "rust",
    ".scss": "scss",
    ".sql": "sql",
    ".toml": "toml",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".yaml": "yaml",
    ".yml": "yaml",
}


@dataclass(frozen=True)
class ArtifactClassification:
    source_type: ArtifactSourceType
    artifact_role: ArtifactRole
    language: str | None
    reason: str


IGNORED_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "build",
    "dist",
    "node_modules",
    "target",
    "vendor",
}
IGNORED_EXTENSIONS = {
    ".avi",
    ".bin",
    ".class",
    ".dll",
    ".dylib",
    ".exe",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    # NOTE: ".lock" 은 IGNORE 하지 않는다.
    # 의존성 lock 파일(uv.lock, Pipfile.lock, yarn.lock, Gemfile.lock, composer.lock,
    # Cargo.lock 등) 은 의존성 정보의 1차 근거이므로 structural_extractor 가 파싱해야 한다.
    # 그래서 .lock 확장자를 IGNORE 목록에서 명시적으로 제외한다.
    ".mp3",
    ".mp4",
    ".o",
    ".pdfx",
    ".png",
    ".pyc",
    ".so",
    ".webp",
}


def is_safe_zip_member(name: str) -> bool:
    path = PurePosixPath(name)
    if not path.parts:
        return False
    if "\\" in name or "\x00" in name or ":" in path.parts[0]:
        return False
    if path.is_absolute() or ".." in path.parts:
        return False
    return bool(path.parts) and not name.endswith("/")


def should_ignore_path(path: str) -> bool:
    parts = PurePosixPath(path).parts
    return any(part in IGNORED_DIRS for part in parts)


def classify_path(path: str) -> ArtifactSourceType:
    return classify_artifact(path).source_type


def classify_artifact(path: str) -> ArtifactClassification:
    posix_path = PurePosixPath(path)
    suffix = posix_path.suffix.lower()
    name = posix_path.name.lower()
    parts = tuple(part.lower() for part in posix_path.parts)

    if should_ignore_path(path):
        return ArtifactClassification(
            source_type=ArtifactSourceType.IGNORED,
            artifact_role=ArtifactRole.IGNORED,
            language=None,
            reason="ignored_path",
        )
    if suffix in IGNORED_EXTENSIONS:
        return ArtifactClassification(
            source_type=ArtifactSourceType.IGNORED,
            artifact_role=ArtifactRole.IGNORED,
            language=None,
            reason="unsupported_extension",
        )
    if name in OVERVIEW_NAMES:
        return ArtifactClassification(
            source_type=ArtifactSourceType.DOCUMENT,
            artifact_role=ArtifactRole.CODEBASE_OVERVIEW,
            language="markdown",
            reason="overview_file_name",
        )
    if name in API_SPEC_NAMES:
        return ArtifactClassification(
            source_type=ArtifactSourceType.CODE,
            artifact_role=ArtifactRole.CODEBASE_API_SPEC,
            language=LANGUAGE_BY_EXTENSION.get(suffix),
            reason="api_spec_file_name",
        )
    if name in CONFIG_FILE_NAMES:
        return ArtifactClassification(
            source_type=ArtifactSourceType.CODE,
            artifact_role=ArtifactRole.CODEBASE_CONFIG,
            language=LANGUAGE_BY_EXTENSION.get(suffix),
            reason="config_file_name",
        )
    if suffix == ".pdf":
        return ArtifactClassification(
            source_type=ArtifactSourceType.DOCUMENT,
            artifact_role=ArtifactRole.PROJECT_REPORT,
            language=None,
            reason="pdf_project_report",
        )
    if suffix == ".pptx":
        return ArtifactClassification(
            source_type=ArtifactSourceType.DOCUMENT,
            artifact_role=ArtifactRole.PROJECT_PRESENTATION,
            language=None,
            reason="pptx_project_presentation",
        )
    if suffix == ".docx":
        return ArtifactClassification(
            source_type=ArtifactSourceType.DOCUMENT,
            artifact_role=ArtifactRole.PROJECT_DESIGN_DOC,
            language=None,
            reason="docx_project_design_doc",
        )
    if suffix in {".md", ".txt"}:
        return ArtifactClassification(
            source_type=ArtifactSourceType.DOCUMENT,
            artifact_role=ArtifactRole.PROJECT_DESCRIPTION,
            language="markdown" if suffix == ".md" else "text",
            reason="project_description_text",
        )
    if suffix in CODE_EXTENSIONS:
        role = (
            ArtifactRole.CODEBASE_TEST
            if _is_test_path(posix_path, parts)
            else ArtifactRole.CODEBASE_SOURCE
        )
        return ArtifactClassification(
            source_type=ArtifactSourceType.CODE,
            artifact_role=role,
            language=LANGUAGE_BY_EXTENSION.get(suffix),
            reason="test_path" if role == ArtifactRole.CODEBASE_TEST else "source_extension",
        )
    return ArtifactClassification(
        source_type=ArtifactSourceType.IGNORED,
        artifact_role=ArtifactRole.IGNORED,
        language=None,
        reason="unsupported_extension",
    )


def _is_test_path(path: PurePosixPath, parts: tuple[str, ...]) -> bool:
    stem = path.stem.lower()
    return (
        any(part in TEST_MARKERS for part in parts)
        or stem.startswith("test_")
        or stem.endswith("_test")
        or ".test" in path.name.lower()
        or ".spec" in path.name.lower()
    )
