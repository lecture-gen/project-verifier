"""제출 zip의 artifact 목록에서 LLM 호출 없이 결정적으로 메타데이터를 추출한다.

LLM에 넘기는 [STRUCTURAL FACTS] 섹션과 교수자 UI에서 시각화하는 구조 통계의
근거가 되는 모듈. 외부 의존성을 추가하지 않고 표준 라이브러리만 사용한다.
"""

from __future__ import annotations

import json
import re
import tomllib
from collections import Counter
from collections.abc import Iterable
from pathlib import PurePosixPath
from typing import Any

from app.project_evaluations.persistence.models import ProjectArtifactRow


# 디렉터리/파일 수 상한. 거대한 zip이 와도 prompt token이 폭주하지 않도록.
MAX_TREE_ENTRIES = 400
MAX_TREE_DEPTH = 6

CODE_ARTIFACT_ROLES = frozenset(
    {
        "codebase_source",
        "codebase_test",
        "codebase_config",
        "codebase_api_spec",
    }
)
DOC_ARTIFACT_ROLES = frozenset(
    {
        "codebase_overview",
        "project_report",
        "project_presentation",
        "project_design_doc",
        "project_description",
    }
)

# manifest 파일별 파서 디스패치. 모든 manifest 는 명시적 파서를 가져야 한다.
# silent fallback 금지 — 새 manifest 를 추가할 때는 반드시 파서 함수까지 같이 추가한다.
# 등록은 _build_dependency_parser_table() 아래에서 이루어진다 (forward declaration 회피).

ENTRY_POINT_PATTERNS = (
    re.compile(r"(^|/)main\.py$"),
    re.compile(r"(^|/)app\.py$"),
    re.compile(r"(^|/)manage\.py$"),
    re.compile(r"(^|/)server\.py$"),
    re.compile(r"(^|/)__main__\.py$"),
    re.compile(r"(^|/)index\.tsx?$"),
    re.compile(r"(^|/)main\.tsx?$"),
    re.compile(r"(^|/)server\.[tj]sx?$"),
    re.compile(r"(^|/)index\.html$"),
    re.compile(r"(^|/)Application\.java$"),
    re.compile(r"(^|/)main\.go$"),
)

LANGUAGE_BY_EXTENSION = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".swift": "Swift",
    ".m": "Objective-C",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".c": "C",
    ".h": "C/C++ Header",
    ".hpp": "C++ Header",
    ".sql": "SQL",
    ".sh": "Shell",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".html": "HTML",
}

MARKDOWN_HEADER_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")


def extract_structural_facts(
    artifacts: list[ProjectArtifactRow],
) -> dict[str, Any]:
    """artifact 목록을 받아 LLM 입력/UI 시각화에 쓸 deterministic 사실을 반환."""
    if not artifacts:
        return _empty_facts()

    code_artifacts: list[ProjectArtifactRow] = []
    doc_artifacts: list[ProjectArtifactRow] = []
    for artifact in artifacts:
        role = _artifact_role(artifact)
        if role in CODE_ARTIFACT_ROLES:
            code_artifacts.append(artifact)
        elif role in DOC_ARTIFACT_ROLES:
            doc_artifacts.append(artifact)

    language_loc = _language_loc(code_artifacts)
    test_loc = _sum_loc(a for a in code_artifacts if _artifact_role(a) == "codebase_test")
    total_loc = sum(item["loc"] for item in language_loc)
    test_ratio = round(test_loc / total_loc, 4) if total_loc > 0 else 0.0

    return {
        "file_count": len(code_artifacts) + len(doc_artifacts),
        "code_file_count": len(code_artifacts),
        "doc_file_count": len(doc_artifacts),
        "total_loc": total_loc,
        "language_loc": language_loc,
        "test_ratio": test_ratio,
        "file_tree": _file_tree(code_artifacts + doc_artifacts),
        "dependencies": _dependencies(code_artifacts),
        "entry_point_candidates": _entry_points(code_artifacts),
        "readme_outline": _readme_outline(doc_artifacts),
    }


def _empty_facts() -> dict[str, Any]:
    return {
        "file_count": 0,
        "code_file_count": 0,
        "doc_file_count": 0,
        "total_loc": 0,
        "language_loc": [],
        "test_ratio": 0.0,
        "file_tree": [],
        "dependencies": [],
        "entry_point_candidates": [],
        "readme_outline": [],
    }


def _artifact_role(artifact: ProjectArtifactRow) -> str:
    metadata = _metadata(artifact)
    role = metadata.get("artifact_role")
    return str(role) if role else "unknown"


def _metadata(artifact: ProjectArtifactRow) -> dict[str, Any]:
    raw = artifact.metadata_json or "{}"
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise RuntimeError(
            f"artifact metadata가 dict가 아닙니다. artifact_id={artifact.id}"
        )
    return parsed


def _loc(text: str) -> int:
    if not text:
        return 0
    # 비어 있지 않은 줄만 카운트한다.
    return sum(1 for line in text.splitlines() if line.strip())


def _sum_loc(artifacts: Iterable[ProjectArtifactRow]) -> int:
    return sum(_loc(a.raw_text) for a in artifacts)


def _language_loc(code_artifacts: list[ProjectArtifactRow]) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for artifact in code_artifacts:
        metadata = _metadata(artifact)
        language = metadata.get("language")
        if not isinstance(language, str) or not language.strip():
            language = _language_from_path(artifact.source_path)
        loc = _loc(artifact.raw_text)
        if loc <= 0:
            continue
        counter[language] += loc
    return [
        {"language": language, "loc": loc}
        for language, loc in counter.most_common()
    ]


def _language_from_path(source_path: str) -> str:
    suffix = PurePosixPath(source_path).suffix.lower()
    return LANGUAGE_BY_EXTENSION.get(suffix, "Other")


def _file_tree(artifacts: list[ProjectArtifactRow]) -> list[dict[str, Any]]:
    """전체 파일 경로 목록을 평탄화된 트리 노드 리스트로 변환한다."""
    seen: set[str] = set()
    nodes: list[dict[str, Any]] = []
    for artifact in artifacts:
        path = artifact.source_path
        parts = [p for p in PurePosixPath(path).parts if p]
        for i, part in enumerate(parts, start=1):
            joined = "/".join(parts[:i])
            depth = i - 1
            if depth > MAX_TREE_DEPTH:
                continue
            if joined in seen:
                continue
            seen.add(joined)
            kind = "dir" if i < len(parts) else "file"
            nodes.append({"path": joined, "kind": kind, "depth": depth})
            if len(nodes) >= MAX_TREE_ENTRIES:
                return sorted(nodes, key=lambda n: n["path"])
    return sorted(nodes, key=lambda n: n["path"])


def _dependencies(code_artifacts: list[ProjectArtifactRow]) -> list[dict[str, Any]]:
    """의존성 manifest를 직접 파싱해 패키지 목록을 반환한다.

    파일 이름별로 명시적 파서가 등록되어 있어야 한다. 등록되지 않은 manifest 는
    처리하지 않는다 (silent fallback 금지).
    대소문자 차이(zip 안 `cargo.toml` 등 비표준 소문자) 를 흡수하기 위해 lowercased
    lookup table 도 함께 사용한다.
    """
    parser_table = _DEPENDENCY_PARSERS
    lower_parser_table = {key.lower(): value for key, value in parser_table.items()}
    deps: list[dict[str, Any]] = []
    for artifact in code_artifacts:
        name = PurePosixPath(artifact.source_path).name
        parser = parser_table.get(name) or lower_parser_table.get(name.lower())
        if parser is None:
            continue
        manifest_label = artifact.source_path
        text = artifact.raw_text or ""
        deps.extend(parser(text, manifest_label))
    return deps


def _parse_package_json(text: str, manifest: str) -> list[dict[str, Any]]:
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"package.json이 JSON object가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        section = data.get(key)
        if not isinstance(section, dict):
            continue
        for name, version in section.items():
            out.append(
                {
                    "manifest": manifest,
                    "name": str(name),
                    "version": str(version) if version is not None else None,
                    "scope": key,
                }
            )
    return out


def _parse_requirements_txt(text: str, manifest: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        match = re.match(r"^([A-Za-z0-9_.\-\[\]]+)\s*([<>=!~].+)?$", line)
        if not match:
            continue
        name = match.group(1)
        version = match.group(2).strip() if match.group(2) else None
        out.append({"manifest": manifest, "name": name, "version": version})
    return out


def _parse_pyproject_toml(text: str, manifest: str) -> list[dict[str, Any]]:
    """pyproject.toml 을 파싱한다. PEP 621 / Poetry / PEP 735 (uv) 모두 지원."""
    data = tomllib.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"pyproject.toml 이 TOML object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []

    # PEP 621 [project].dependencies / [project].optional-dependencies
    project = data.get("project")
    if isinstance(project, dict):
        deps = project.get("dependencies")
        if isinstance(deps, list):
            for entry in deps:
                if not isinstance(entry, str):
                    continue
                parsed = _parse_requirement_spec(entry)
                out.append({"manifest": manifest, **parsed, "scope": "project"})
        optional = project.get("optional-dependencies")
        if isinstance(optional, dict):
            for group, entries in optional.items():
                if not isinstance(entries, list):
                    continue
                for entry in entries:
                    if not isinstance(entry, str):
                        continue
                    parsed = _parse_requirement_spec(entry)
                    out.append(
                        {"manifest": manifest, **parsed, "scope": f"optional:{group}"}
                    )

    # PEP 735 [dependency-groups]  — uv, pip 의 dev group 표준
    dep_groups = data.get("dependency-groups")
    if isinstance(dep_groups, dict):
        for group_name, entries in dep_groups.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if isinstance(entry, str):
                    parsed = _parse_requirement_spec(entry)
                    out.append(
                        {
                            "manifest": manifest,
                            **parsed,
                            "scope": f"group:{group_name}",
                        }
                    )
                elif isinstance(entry, dict) and isinstance(entry.get("include-group"), str):
                    # group include 는 의존성이 아니므로 메타로 기록한다.
                    out.append(
                        {
                            "manifest": manifest,
                            "name": f"@include {entry['include-group']}",
                            "version": None,
                            "scope": f"group:{group_name}",
                        }
                    )

    # Poetry [tool.poetry.dependencies]
    poetry = data.get("tool", {}).get("poetry") if isinstance(data.get("tool"), dict) else None
    if isinstance(poetry, dict):
        for section in ("dependencies", "dev-dependencies", "group"):
            value = poetry.get(section)
            if section == "group" and isinstance(value, dict):
                for group_name, group_value in value.items():
                    group_deps = (
                        group_value.get("dependencies")
                        if isinstance(group_value, dict)
                        else None
                    )
                    if isinstance(group_deps, dict):
                        out.extend(
                            _expand_name_version_table(
                                group_deps, manifest, scope=f"poetry-group:{group_name}"
                            )
                        )
            elif isinstance(value, dict):
                out.extend(
                    _expand_name_version_table(
                        value, manifest, scope=f"poetry:{section}"
                    )
                )

    # uv 전용 [tool.uv.sources] 는 의존성 본체가 아니라 source 매핑이라 무시한다.
    return out


def _parse_cargo_toml(text: str, manifest: str) -> list[dict[str, Any]]:
    """Cargo.toml [dependencies] / [dev-dependencies] / [build-dependencies]."""
    data = tomllib.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"Cargo.toml 이 TOML object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for section_name in ("dependencies", "dev-dependencies", "build-dependencies"):
        section = data.get(section_name)
        if not isinstance(section, dict):
            continue
        out.extend(
            _expand_name_version_table(
                section, manifest, scope=f"cargo:{section_name}"
            )
        )
    return out


def _expand_name_version_table(
    section: dict[str, Any], manifest: str, scope: str
) -> list[dict[str, Any]]:
    """`{name: version-spec or table}` 형태 TOML 섹션을 단순 항목 리스트로 변환."""
    out: list[dict[str, Any]] = []
    for name, value in section.items():
        if str(name).lower() == "python":
            continue
        version = None
        if isinstance(value, str):
            version = value
        elif isinstance(value, dict):
            version = value.get("version") if isinstance(value.get("version"), str) else None
        out.append(
            {
                "manifest": manifest,
                "name": str(name),
                "version": version,
                "scope": scope,
            }
        )
    return out


def _parse_requirement_spec(spec: str) -> dict[str, Any]:
    spec = spec.strip()
    match = re.match(r"^([A-Za-z0-9_.\-\[\]]+)\s*([<>=!~].+)?$", spec)
    if not match:
        return {"name": spec, "version": None}
    name = match.group(1)
    version = match.group(2).strip() if match.group(2) else None
    return {"name": name, "version": version}


_POM_DEP_RE = re.compile(
    r"<dependency>\s*"
    r"<groupId>([^<]+)</groupId>\s*"
    r"<artifactId>([^<]+)</artifactId>\s*"
    r"(?:<version>([^<]+)</version>\s*)?",
    re.DOTALL,
)


def _parse_pom_xml(text: str, manifest: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for match in _POM_DEP_RE.finditer(text):
        group_id, artifact_id, version = match.group(1), match.group(2), match.group(3)
        out.append(
            {
                "manifest": manifest,
                "name": f"{group_id.strip()}:{artifact_id.strip()}",
                "version": version.strip() if version else None,
            }
        )
    return out


def _parse_go_mod(text: str, manifest: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    in_require_block = False
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("//"):
            continue
        if line.startswith("require ("):
            in_require_block = True
            continue
        if line == ")" and in_require_block:
            in_require_block = False
            continue
        if in_require_block:
            parts = line.split()
            if len(parts) >= 2:
                out.append(
                    {"manifest": manifest, "name": parts[0], "version": parts[1]}
                )
            continue
        if line.startswith("require "):
            parts = line[len("require ") :].split()
            if len(parts) >= 2:
                out.append(
                    {"manifest": manifest, "name": parts[0], "version": parts[1]}
                )
    return out


def _entry_points(code_artifacts: list[ProjectArtifactRow]) -> list[str]:
    out: list[str] = []
    for artifact in code_artifacts:
        path = artifact.source_path
        if any(pattern.search(path) for pattern in ENTRY_POINT_PATTERNS):
            out.append(path)
    return sorted(set(out))


# ---------------------------------------------------------------------------
# 추가 manifest 파서 (Python lock / JS lock / Ruby / PHP / Gradle / uv)
# 모두 silent fallback 없이 명시 구현.
# ---------------------------------------------------------------------------


def _parse_pipfile(text: str, manifest: str) -> list[dict[str, Any]]:
    """Pipfile (TOML) — [packages], [dev-packages]."""
    data = tomllib.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"Pipfile 이 TOML object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for section_name in ("packages", "dev-packages"):
        section = data.get(section_name)
        if isinstance(section, dict):
            out.extend(
                _expand_name_version_table(
                    section, manifest, scope=f"pipenv:{section_name}"
                )
            )
    return out


def _parse_pipfile_lock(text: str, manifest: str) -> list[dict[str, Any]]:
    """Pipfile.lock (JSON) — default / develop 섹션."""
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"Pipfile.lock 이 JSON object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for section_name in ("default", "develop"):
        section = data.get(section_name)
        if not isinstance(section, dict):
            continue
        for name, entry in section.items():
            version = None
            if isinstance(entry, dict):
                raw_version = entry.get("version")
                if isinstance(raw_version, str):
                    version = raw_version.lstrip("=").strip()
            out.append(
                {
                    "manifest": manifest,
                    "name": str(name),
                    "version": version,
                    "scope": f"pipenv-lock:{section_name}",
                }
            )
    return out


def _parse_uv_lock(text: str, manifest: str) -> list[dict[str, Any]]:
    """uv.lock (TOML) — [[package]] 배열. resolved 의존성 전체."""
    data = tomllib.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"uv.lock 이 TOML object 가 아닙니다: {manifest}")
    packages = data.get("package")
    if not isinstance(packages, list):
        return []
    out: list[dict[str, Any]] = []
    for entry in packages:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        version = entry.get("version")
        if not isinstance(name, str):
            continue
        out.append(
            {
                "manifest": manifest,
                "name": name,
                "version": version if isinstance(version, str) else None,
                "scope": "uv-lock",
            }
        )
    return out


def _parse_package_lock_json(text: str, manifest: str) -> list[dict[str, Any]]:
    """package-lock.json (JSON) — npm v3+ 의 packages 트리, 또는 v1 의 dependencies 트리."""
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"package-lock.json 이 JSON object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()
    packages = data.get("packages")
    if isinstance(packages, dict):
        # v3+: key 는 "" (root) 또는 "node_modules/<pkg>" 또는
        # "node_modules/<scope>/<pkg>"; 중첩 경로도 가능.
        for key, entry in packages.items():
            if not isinstance(entry, dict):
                continue
            if key == "":
                continue  # root project entry
            name = _name_from_node_modules_path(key)
            if name is None:
                continue
            version = entry.get("version")
            scope = "lock-dev" if entry.get("dev") else "lock"
            pair = (name, version if isinstance(version, str) else None)
            if pair in seen:
                continue
            seen.add(pair)
            out.append(
                {
                    "manifest": manifest,
                    "name": name,
                    "version": version if isinstance(version, str) else None,
                    "scope": scope,
                }
            )
        return out
    # v1: dependencies 트리(재귀)
    deps_v1 = data.get("dependencies")
    if isinstance(deps_v1, dict):
        _walk_npm_v1_deps(deps_v1, manifest, out, seen)
    return out


def _name_from_node_modules_path(key: str) -> str | None:
    """`node_modules/a/node_modules/@scope/b` → `@scope/b`."""
    parts = key.split("node_modules/")
    last = parts[-1].strip("/")
    if not last:
        return None
    return last


def _walk_npm_v1_deps(
    tree: dict[str, Any],
    manifest: str,
    out: list[dict[str, Any]],
    seen: set[tuple[str, str | None]],
) -> None:
    for name, entry in tree.items():
        if not isinstance(entry, dict):
            continue
        version = entry.get("version") if isinstance(entry.get("version"), str) else None
        pair = (name, version)
        if pair not in seen:
            seen.add(pair)
            out.append(
                {
                    "manifest": manifest,
                    "name": name,
                    "version": version,
                    "scope": "lock",
                }
            )
        nested = entry.get("dependencies")
        if isinstance(nested, dict):
            _walk_npm_v1_deps(nested, manifest, out, seen)


_PNPM_SPECIFIER_RE = re.compile(
    r"^\s+'?(@?[\w][\w@\-./]*?)'?:\s*\n\s+specifier:\s*([^\n]+)",
    re.MULTILINE,
)
_PNPM_PACKAGES_KEY_RE = re.compile(r"^\s+'(@?[\w@\-./]+)@([^':()]+)(?:\([^)]*\))?':", re.MULTILINE)


def _parse_pnpm_lock_yaml(text: str, manifest: str) -> list[dict[str, Any]]:
    """pnpm-lock.yaml — 표준 라이브러리만 사용해 regex 로 파싱.

    1차: importers 블록 안의 `<pkg>: { specifier, version }` 패턴.
    importers 블록이 비어 있으면 2차로 `packages:` 섹션의 `<pkg>@<ver>:` 키.
    """
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()

    importers_match = re.search(
        r"^importers:\s*\n(.*?)(?=^\S|\Z)",
        text,
        re.MULTILINE | re.DOTALL,
    )
    if importers_match:
        section = importers_match.group(1)
        for m in _PNPM_SPECIFIER_RE.finditer(section):
            name = m.group(1)
            version = m.group(2).strip()
            if (name, version) in seen:
                continue
            seen.add((name, version))
            out.append(
                {
                    "manifest": manifest,
                    "name": name,
                    "version": version,
                    "scope": "pnpm-lock",
                }
            )
    if out:
        return out

    # 2차 fallback: importers 가 없거나 비었을 때 packages 섹션의 resolved 키 추출.
    for m in _PNPM_PACKAGES_KEY_RE.finditer(text):
        name = m.group(1)
        version = m.group(2).strip()
        if (name, version) in seen:
            continue
        seen.add((name, version))
        out.append(
            {
                "manifest": manifest,
                "name": name,
                "version": version,
                "scope": "pnpm-lock-resolved",
            }
        )
    return out


_YARN_VERSION_RE = re.compile(r'^\s+version\s+"([^"]+)"')


def _parse_yarn_lock(text: str, manifest: str) -> list[dict[str, Any]]:
    """yarn.lock (custom YAML-ish) — 헤더 라인의 패키지 이름 + 본문 version 추출.

    헤더 라인 형식:
        "react@^19.0.0":
        "@types/node@^20.0.0", "@types/node@^20.5.0":
        gulp@^4.0.0:
    """
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    current_name: str | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line or line.startswith("#"):
            continue
        if not line.startswith(" "):
            # 새 헤더 라인. 끝의 콜론과 따옴표를 제거하고, 쉼표 분리된 spec 중 첫 번째만 사용.
            header = line.rstrip(":").strip()
            first_spec = header.split(",")[0].strip().strip('"').strip("'")
            if not first_spec:
                current_name = None
                continue
            # scoped(@scope/name@ver) 와 일반(name@ver) 모두 처리:
            #   scoped 면 첫 글자가 '@', 두 번째 '@' 가 spec 구분자.
            if first_spec.startswith("@"):
                at_index = first_spec.find("@", 1)
            else:
                at_index = first_spec.find("@")
            current_name = first_spec[:at_index] if at_index > 0 else first_spec
            continue
        version_match = _YARN_VERSION_RE.match(line)
        if version_match and current_name:
            version = version_match.group(1)
            if (current_name, version) not in seen:
                seen.add((current_name, version))
                out.append(
                    {
                        "manifest": manifest,
                        "name": current_name,
                        "version": version,
                        "scope": "yarn-lock",
                    }
                )
            current_name = None
    return out


def _parse_composer_json(text: str, manifest: str) -> list[dict[str, Any]]:
    """composer.json — require / require-dev."""
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"composer.json 이 JSON object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for key in ("require", "require-dev"):
        section = data.get(key)
        if not isinstance(section, dict):
            continue
        for name, version in section.items():
            out.append(
                {
                    "manifest": manifest,
                    "name": str(name),
                    "version": str(version) if version is not None else None,
                    "scope": f"composer:{key}",
                }
            )
    return out


def _parse_composer_lock(text: str, manifest: str) -> list[dict[str, Any]]:
    """composer.lock — packages / packages-dev 배열."""
    data = json.loads(text)
    if not isinstance(data, dict):
        raise RuntimeError(f"composer.lock 이 JSON object 가 아닙니다: {manifest}")
    out: list[dict[str, Any]] = []
    for key in ("packages", "packages-dev"):
        section = data.get(key)
        if not isinstance(section, list):
            continue
        for entry in section:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            version = entry.get("version")
            if not isinstance(name, str):
                continue
            out.append(
                {
                    "manifest": manifest,
                    "name": name,
                    "version": version if isinstance(version, str) else None,
                    "scope": f"composer-lock:{key}",
                }
            )
    return out


_GEMFILE_GEM_RE = re.compile(
    r"""^\s*gem\s+
        ['"]([\w.\-]+)['"]                # gem name
        (?:\s*,\s*['"]([^'"]+)['"])?      # optional version constraint
        (?:\s*,\s*['"]([^'"]+)['"])?      # optional second constraint
    """,
    re.VERBOSE | re.MULTILINE,
)


def _parse_gemfile(text: str, manifest: str) -> list[dict[str, Any]]:
    """Gemfile (Ruby DSL) — `gem 'name', '~> 1.0'` 패턴 추출."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for m in _GEMFILE_GEM_RE.finditer(text):
        name = m.group(1)
        if name in seen:
            continue
        seen.add(name)
        constraints = [c for c in (m.group(2), m.group(3)) if c]
        version = ", ".join(constraints) if constraints else None
        out.append(
            {
                "manifest": manifest,
                "name": name,
                "version": version,
                "scope": "gemfile",
            }
        )
    return out


_GEMFILE_LOCK_SPEC_RE = re.compile(r"^    ([\w.\-]+) \(([^)]+)\)\s*$")


def _parse_gemfile_lock(text: str, manifest: str) -> list[dict[str, Any]]:
    """Gemfile.lock — GEM/specs: 블록의 `    name (version)` 라인."""
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    in_specs = False
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if line.strip() == "specs:":
            in_specs = True
            continue
        if not line.startswith(" "):
            # 새 섹션 헤더 (PLATFORMS, DEPENDENCIES, BUNDLED WITH 등) → specs 종료.
            in_specs = False
            continue
        if not in_specs:
            continue
        match = _GEMFILE_LOCK_SPEC_RE.match(line)
        if match:
            name, version = match.group(1), match.group(2)
            if (name, version) not in seen:
                seen.add((name, version))
                out.append(
                    {
                        "manifest": manifest,
                        "name": name,
                        "version": version,
                        "scope": "gemfile-lock",
                    }
                )
    return out


_GRADLE_DEP_RE = re.compile(
    r"""(?:^|\s)
        (implementation|api|compileOnly|runtimeOnly|testImplementation|
         testRuntimeOnly|annotationProcessor|kapt|ksp|debugImplementation|
         releaseImplementation|androidTestImplementation)
        \s*[(\s]
        ['"]([^'"\n:]+):([^'"\n:]+):([^'"\n)]+)['"]
    """,
    re.VERBOSE | re.MULTILINE,
)


def _parse_gradle(text: str, manifest: str) -> list[dict[str, Any]]:
    """build.gradle / build.gradle.kts — `<config> 'group:artifact:version'` 패턴."""
    out: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for m in _GRADLE_DEP_RE.finditer(text):
        config, group_id, artifact_id, version = (
            m.group(1),
            m.group(2),
            m.group(3),
            m.group(4),
        )
        key = (group_id, artifact_id, version)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "manifest": manifest,
                "name": f"{group_id}:{artifact_id}",
                "version": version,
                "scope": f"gradle:{config}",
            }
        )
    return out


# ---------------------------------------------------------------------------
# Dispatch table — 새 manifest 를 추가할 때는 이 dict 에 반드시 등록.
# ---------------------------------------------------------------------------
_DEPENDENCY_PARSERS: dict[str, Any] = {
    # Python
    "requirements.txt": _parse_requirements_txt,
    "pyproject.toml": _parse_pyproject_toml,
    "Pipfile": _parse_pipfile,
    "Pipfile.lock": _parse_pipfile_lock,
    "uv.lock": _parse_uv_lock,
    # JavaScript / TypeScript
    "package.json": _parse_package_json,
    "package-lock.json": _parse_package_lock_json,
    "pnpm-lock.yaml": _parse_pnpm_lock_yaml,
    "yarn.lock": _parse_yarn_lock,
    # JVM
    "pom.xml": _parse_pom_xml,
    "build.gradle": _parse_gradle,
    "build.gradle.kts": _parse_gradle,
    # Go
    "go.mod": _parse_go_mod,
    # Rust
    "Cargo.toml": _parse_cargo_toml,
    # Ruby
    "Gemfile": _parse_gemfile,
    "Gemfile.lock": _parse_gemfile_lock,
    # PHP
    "composer.json": _parse_composer_json,
    "composer.lock": _parse_composer_lock,
}


def _readme_outline(doc_artifacts: list[ProjectArtifactRow]) -> list[dict[str, Any]]:
    """codebase_overview 중 README 계열 파일의 markdown 헤더 트리를 뽑는다."""
    candidates: list[ProjectArtifactRow] = []
    for artifact in doc_artifacts:
        role = _artifact_role(artifact)
        if role != "codebase_overview":
            continue
        name = PurePosixPath(artifact.source_path).name.lower()
        if name.startswith("readme") or name in {"claude.md"}:
            candidates.append(artifact)
    if not candidates:
        return []
    # 우선순위: 루트 README > 그 외
    candidates.sort(
        key=lambda a: (len(PurePosixPath(a.source_path).parts), a.source_path)
    )
    primary = candidates[0]
    outline: list[dict[str, Any]] = []
    for line in (primary.raw_text or "").splitlines():
        match = MARKDOWN_HEADER_RE.match(line.strip())
        if match:
            outline.append(
                {
                    "level": len(match.group(1)),
                    "text": match.group(2).strip(),
                    "source_path": primary.source_path,
                }
            )
    return outline
