from __future__ import annotations

import logging
import re
from collections import Counter
from collections.abc import Callable
from urllib.parse import quote, urlparse

import httpx

_logger = logging.getLogger(__name__)

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.exc import IntegrityError

from app.core.rate_limit import (
    check_auth_attempt as _check_auth_attempt,
    clear_auth_failures as _clear_auth_failures,
    record_auth_failure as _record_auth_failure,
)
from app.core.security import (
    hash_password as _hash_password,
    new_session_token as _new_session_token,
    verify_password as _verify_password,
)
from app.project_evaluations.analysis.context_builder import (
    build_project_context,
)
from app.project_evaluations.analysis.llm_client import LlmClient
from app.project_evaluations.analysis.prompts import build_project_context_brief
from app.project_evaluations.analysis.quality_assessor import run_quality_assessment
from app.project_evaluations.domain.models import (
    ArtifactStatus,
    ArtifactUploadResult,
    EvaluationReportRead,
    EvaluationStatus,
    ExtractedProjectContextRead,
    FollowUpExchange,
    InterviewQuestionRead,
    InterviewSessionRead,
    InterviewTurnCreate,
    InterviewTurnRead,
    JoinEvaluationRead,
    ProjectArtifactRead,
    ProjectEvaluationCreate,
    ProjectEvaluationRead,
    ProjectEvaluationStatusRead,
    ProjectEvaluationSummaryRead,
    ProjectQualityAssessmentRead,
    QuestionExchange,
    QuestionGenerationPolicy,
)
from app.project_evaluations.ingestion.file_classifier import (
    CODE_EXTENSIONS,
    DOCUMENT_EXTENSIONS,
)
from app.project_evaluations.ingestion.zip_handler import (
    extract_zip_artifacts,
    extract_zip_bytes,
)
from app.project_evaluations.interview.evaluator import (
    conversation_history_text,
    evaluate_answer,
)
from app.project_evaluations.interview.question_generator import (
    generate_questions,
)
from app.project_evaluations.persistence.repository import (
    ProjectEvaluationRepository,
    from_json,
)
from app.project_evaluations.rag.redaction import redact_sensitive_text
from app.project_evaluations.reports.report_generator import (
    generate_report_payload,
)
from app.settings import ApiSettings

_ABORT_UNANSWERED_TEXT = "(미응답)"

_GITHUB_REPO_RE = re.compile(r"^[A-Za-z0-9._-]+$")


def _parse_github_repo_url(github_url: str) -> tuple[str, str]:
    """`https://github.com/{owner}/{repo}` 형태에서 (owner, repo) 추출.

    `.git` suffix, trailing slash 모두 정리하고 owner/repo 만 허용한다. 그 외 경로(/tree/main 등)는 거부.
    """

    raw = (github_url or "").strip()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "stage": "github_import",
                "reason": "empty_url",
                "message": "GitHub 저장소 URL이 비어 있습니다.",
            },
        )
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != "github.com":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "stage": "github_import",
                "reason": "invalid_host",
                "message": "https://github.com/{owner}/{repo} 형식의 URL만 허용합니다.",
                "url": raw,
            },
        )
    path_segments = [segment for segment in parsed.path.split("/") if segment]
    if len(path_segments) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "stage": "github_import",
                "reason": "missing_owner_or_repo",
                "message": "URL 에 owner/repo 가 모두 포함되어야 합니다.",
                "url": raw,
            },
        )
    owner, repo = path_segments[0], path_segments[1]
    if repo.endswith(".git"):
        repo = repo[: -len(".git")]
    if not _GITHUB_REPO_RE.match(owner) or not _GITHUB_REPO_RE.match(repo):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "stage": "github_import",
                "reason": "invalid_owner_or_repo",
                "message": "owner/repo 이름이 유효하지 않습니다.",
                "url": raw,
            },
        )
    return owner, repo


def _download_github_zip(
    owner: str,
    repo: str,
    *,
    max_bytes: int,
    timeout_seconds: float = 30.0,
) -> tuple[bytes, str]:
    """public repo 의 기본 브랜치 zip 을 받아 bytes 로 반환.

    1) GET https://api.github.com/repos/{owner}/{repo} 로 default_branch 조회.
    2) GET https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch} 로 zip 받음.
    응답 Content-Type 이 application/zip 이 아니거나 max_bytes 초과면 raise.
    """

    headers = {
        "User-Agent": "v2-project-evaluation/0.1 (+github-import)",
        "Accept": "application/vnd.github+json",
    }
    with httpx.Client(timeout=timeout_seconds, follow_redirects=True) as client:
        meta_resp = client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers=headers,
        )
        if meta_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "stage": "github_import",
                    "reason": "repo_metadata_failed",
                    "message": "GitHub 저장소 메타데이터를 가져오지 못했습니다.",
                    "owner": owner,
                    "repo": repo,
                    "github_status": meta_resp.status_code,
                },
            )
        meta = meta_resp.json()
        if not isinstance(meta, dict) or "default_branch" not in meta:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "stage": "github_import",
                    "reason": "default_branch_missing",
                    "message": "GitHub 응답에서 default_branch 를 찾을 수 없습니다.",
                    "owner": owner,
                    "repo": repo,
                },
            )
        default_branch = str(meta["default_branch"])

        zip_url = (
            f"https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{quote(default_branch, safe='')}"
        )
        chunks: list[bytes] = []
        total = 0
        with client.stream("GET", zip_url, headers=headers) as response:
            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={
                        "stage": "github_import",
                        "reason": "codeload_failed",
                        "message": "codeload 에서 zip 을 받지 못했습니다.",
                        "owner": owner,
                        "repo": repo,
                        "branch": default_branch,
                        "github_status": response.status_code,
                    },
                )
            content_type = response.headers.get("Content-Type", "").lower()
            if "application/zip" not in content_type and "application/x-zip" not in content_type:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={
                        "stage": "github_import",
                        "reason": "unexpected_content_type",
                        "message": "codeload 응답이 zip 이 아닙니다.",
                        "owner": owner,
                        "repo": repo,
                        "branch": default_branch,
                        "content_type": content_type,
                    },
                )
            for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail={
                            "stage": "github_import",
                            "reason": "zip_too_large",
                            "message": "다운로드한 저장소 zip 이 허용 크기를 초과했습니다.",
                            "owner": owner,
                            "repo": repo,
                            "branch": default_branch,
                            "max_bytes": max_bytes,
                            "actual_bytes": total,
                        },
                    )
                chunks.append(chunk)
        return b"".join(chunks), f"{owner}-{repo}-{default_branch}.zip"



def _safe_error_message(exc: Exception, prefix: str) -> str:
    detail = redact_sensitive_text(" ".join(str(exc).split()))[:240]
    return f"{prefix} 원인: {detail}" if detail else prefix


def _stage_error_detail(stage: str, message: str, exc: Exception, **context: object) -> dict[str, object]:
    detail: dict[str, object] = {
        "stage": stage,
        "error_type": type(exc).__name__,
        "message": _safe_error_message(exc, message),
    }
    return {**detail, **{key: value for key, value in context.items() if value not in (None, "", {})}}


class ProjectEvaluationService:
    def __init__(
        self, repository: ProjectEvaluationRepository, settings: ApiSettings
    ) -> None:
        self.repository = repository
        self.settings = settings
        self._analysis_llm = LlmClient(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_ANALYSIS_MODEL,
        )
        self._question_llm = LlmClient(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_QUESTION_MODEL,
        )
        self._eval_llm = LlmClient(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EVAL_MODEL,
        )
        self._report_llm = LlmClient(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EVAL_MODEL,
        )
        self._openai = None
        self._qdrant = None
        if settings.RAG_ENABLED and settings.OPENAI_API_KEY:
            from openai import OpenAI

            self._openai = OpenAI(api_key=settings.OPENAI_API_KEY)
        if settings.RAG_ENABLED and settings.QDRANT_URL and self._openai is not None:
            from qdrant_client import QdrantClient

            self._qdrant = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY or None,
            )

    def create_evaluation(
        self, payload: ProjectEvaluationCreate
    ) -> ProjectEvaluationRead:
        if sum(payload.question_policy.bloom_ratios.values()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bloom 비율은 하나 이상 1 이상이어야 합니다.",
            )
        return self.repository.create_evaluation(payload)

    def list_evaluation_summaries(self) -> list[ProjectEvaluationSummaryRead]:
        return self.repository.list_evaluation_summaries()

    def update_question_policy(
        self,
        evaluation_id: str,
        policy: QuestionGenerationPolicy,
    ) -> ProjectEvaluationRead:
        self.get_evaluation(evaluation_id)
        if sum(policy.bloom_ratios.values()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bloom 비율은 하나 이상 1 이상이어야 합니다.",
            )
        evaluation_status = self.get_status(evaluation_id)
        allowed_phases = {"created", "uploaded", "context_ready"}
        if evaluation_status.phase not in allowed_phases:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "stage": "question_policy_update",
                    "reason": "policy_locked",
                    "message": (
                        "현재 단계에서는 질문 정책을 변경할 수 없습니다. "
                        "질문이 이미 생성된 평가는 별도 재생성 흐름이 필요합니다."
                    ),
                    "phase": evaluation_status.phase,
                    "allowed_phases": sorted(allowed_phases),
                },
            )
        updated = self.repository.update_question_policy(evaluation_id, policy)
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="프로젝트 평가를 찾을 수 없습니다.",
            )
        return updated

    def get_evaluation(self, evaluation_id: str) -> ProjectEvaluationRead:
        evaluation = self.repository.get_evaluation(evaluation_id)
        if evaluation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="프로젝트 평가를 찾을 수 없습니다.",
            )
        return evaluation

    def get_status(self, evaluation_id: str) -> ProjectEvaluationStatusRead:
        evaluation = self.get_evaluation(evaluation_id)
        has_artifacts = self.repository.has_artifacts(evaluation_id)
        context_row = self.repository.get_context_row(evaluation_id)
        question_rows = self.repository.list_question_rows(evaluation_id)
        question_policy = self.repository.get_question_policy(evaluation_id)
        has_context = context_row is not None
        rag_status = from_json(context_row.rag_status_json, {}) if context_row else {}
        if has_context and not rag_status and not self.settings.RAG_ENABLED:
            rag_status = {"enabled": False, "reason": "rag_disabled"}
        result = self._status_from_rows(
            evaluation_id=evaluation.id,
            status_value=evaluation.status.value,
            has_artifacts=has_artifacts,
            has_context=has_context,
            rag_status=rag_status,
            question_count=len(question_rows),
            expected_question_count=question_policy.total_question_count,
            has_sessions=self.repository.has_sessions(evaluation_id),
        )
        return result.model_copy(
            update={
                "has_quality_assessment": self.repository.has_quality_assessment(
                    evaluation_id
                ),
            }
        )

    def _status_from_rows(
        self,
        evaluation_id: str,
        status_value: str,
        has_artifacts: bool,
        has_context: bool,
        rag_status: dict[str, object],
        question_count: int,
        expected_question_count: int,
        has_sessions: bool,
    ) -> ProjectEvaluationStatusRead:
        questions_ready = question_count == expected_question_count and question_count > 0
        partial_questions = 0 < question_count < expected_question_count
        question_count_mismatch = question_count > expected_question_count > 0
        rag_ready = rag_status.get("status") == "indexed"
        if not has_artifacts:
            return ProjectEvaluationStatusRead(
                evaluation_id=evaluation_id,
                status=status_value,
                phase="created",
                has_artifacts=False,
                has_context=False,
                rag_status=rag_status,
                question_count=question_count,
                expected_question_count=expected_question_count,
                questions_ready=False,
                can_generate_questions=False,
                can_join=False,
                blocked_reason="artifacts_required",
                user_message="프로젝트 zip 자료를 업로드해야 분석과 질문 생성을 시작할 수 있습니다.",
                check_targets=["zip 업로드", "지원 확장자", "파일 처리 제한"],
            )
        if not has_context:
            return ProjectEvaluationStatusRead(
                evaluation_id=evaluation_id,
                status=status_value,
                phase="uploaded",
                has_artifacts=True,
                has_context=False,
                rag_status=rag_status,
                question_count=question_count,
                expected_question_count=expected_question_count,
                questions_ready=False,
                can_generate_questions=False,
                can_join=False,
                blocked_reason="context_required",
                user_message="자료 업로드는 완료됐지만 프로젝트 분석 context가 아직 생성되지 않았습니다.",
                check_targets=["자료 분석 실행", "RAG 인덱싱 설정", "추출 가능한 텍스트"],
                retryable=True,
            )
        if questions_ready:
            return ProjectEvaluationStatusRead(
                evaluation_id=evaluation_id,
                status=status_value,
                phase="questions_ready",
                has_artifacts=True,
                has_context=True,
                rag_status=rag_status,
                question_count=question_count,
                expected_question_count=expected_question_count,
                questions_ready=True,
                can_generate_questions=False,
                can_join=True,
                user_message="질문이 DB에 저장되어 학생 입장이 가능합니다.",
            )
        if partial_questions or question_count_mismatch:
            return ProjectEvaluationStatusRead(
                evaluation_id=evaluation_id,
                status=status_value,
                phase="question_count_mismatch",
                has_artifacts=True,
                has_context=True,
                rag_status=rag_status,
                question_count=question_count,
                expected_question_count=expected_question_count,
                questions_ready=False,
                can_generate_questions=not has_sessions,
                can_join=False,
                blocked_reason="question_count_mismatch",
                user_message="저장된 질문 수가 질문 정책과 일치하지 않습니다. 질문을 다시 생성해야 합니다.",
                check_targets=["저장된 질문 수", "question_policy", "질문 생성/저장 로그"],
                retryable=not has_sessions,
            )
        if bool(rag_status.get("enabled", self.settings.RAG_ENABLED)) and not rag_ready:
            rag_failed = rag_status.get("status") == "failed"
            return ProjectEvaluationStatusRead(
                evaluation_id=evaluation_id,
                status=status_value,
                phase="indexing_failed" if rag_failed else "rag_not_ready",
                has_artifacts=True,
                has_context=True,
                rag_status=rag_status,
                question_count=question_count,
                expected_question_count=expected_question_count,
                questions_ready=False,
                can_generate_questions=False,
                can_join=False,
                blocked_reason="rag_ingestion_failed" if rag_failed else "rag_not_ready",
                user_message=str(
                    rag_status.get("message")
                    or rag_status.get("reason")
                    or "질문 생성을 위한 RAG 인덱스가 준비되지 않았습니다."
                ),
                check_targets=["Qdrant 실행 상태", "embedding 설정", "RAG chunk 저장 결과"],
                retryable=True,
            )
        return ProjectEvaluationStatusRead(
            evaluation_id=evaluation_id,
            status=status_value,
            phase="context_ready",
            has_artifacts=True,
            has_context=True,
            rag_status=rag_status,
            question_count=0,
            expected_question_count=expected_question_count,
            questions_ready=False,
            can_generate_questions=not has_sessions,
            can_join=False,
            blocked_reason="interview_started" if has_sessions else "questions_required",
            user_message=(
                "검증가 이미 시작되어 질문을 다시 생성할 수 없습니다."
                if has_sessions
                else "프로젝트 분석과 RAG 인덱싱이 완료되었습니다. 질문 생성을 실행할 수 있습니다."
            ),
            check_targets=["질문 생성 실행", "LLM 응답 schema", "source refs 검증"],
            retryable=not has_sessions,
        )

    async def upload_zip(
        self, evaluation_id: str, upload: UploadFile
    ) -> ArtifactUploadResult:
        self._ensure_no_artifacts(evaluation_id)
        extracted = await extract_zip_artifacts(evaluation_id, upload, self.settings)
        return self._ingest_extracted_artifacts(evaluation_id, extracted)

    def upload_github_repo(
        self, evaluation_id: str, github_url: str
    ) -> ArtifactUploadResult:
        self._ensure_no_artifacts(evaluation_id)
        owner, repo = _parse_github_repo_url(github_url)
        zip_bytes, _filename = _download_github_zip(
            owner,
            repo,
            max_bytes=self.settings.APP_MAX_UPLOAD_MB * 1024 * 1024,
        )
        extracted = extract_zip_bytes(evaluation_id, zip_bytes, self.settings)
        del zip_bytes
        return self._ingest_extracted_artifacts(evaluation_id, extracted)

    def _ensure_no_artifacts(self, evaluation_id: str) -> None:
        self.get_evaluation(evaluation_id)
        if self.repository.has_artifacts(evaluation_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 업로드된 자료가 있는 평가는 다시 업로드할 수 없습니다.",
            )

    def _ingest_extracted_artifacts(
        self,
        evaluation_id: str,
        extracted: list,
    ) -> ArtifactUploadResult:
        artifacts = [
            self.repository.create_artifact(
                evaluation_id=evaluation_id,
                source_path=item.source_path,
                source_type=item.source_type,
                status=item.status,
                raw_text=item.raw_text,
                metadata=item.metadata,
            )
            for item in extracted
        ]
        self.repository.update_evaluation_status(
            evaluation_id, EvaluationStatus.UPLOADED
        )
        accepted_count = sum(1 for item in artifacts if item.status == ArtifactStatus.EXTRACTED)
        reason_counts = Counter(
            str(item.metadata.get("reason", "accepted"))
            if item.status != ArtifactStatus.EXTRACTED
            else "accepted"
            for item in artifacts
        )
        return ArtifactUploadResult(
            evaluation_id=evaluation_id,
            accepted_count=accepted_count,
            skipped_count=len(artifacts) - accepted_count,
            ignored_count=reason_counts.get("ignored", 0)
            + reason_counts.get("ignored_path", 0)
            + reason_counts.get("unsupported_extension", 0),
            empty_text_count=reason_counts.get("empty_text", 0),
            file_too_large_count=reason_counts.get("file_too_large", 0),
            processed_file_limit_count=reason_counts.get("processed_file_limit", 0),
            failed_count=sum(1 for item in artifacts if item.status == ArtifactStatus.FAILED),
            reason_counts=dict(reason_counts),
            processing_limits=self._processing_limits(),
            supported_extensions=self._supported_extensions(),
            artifacts=artifacts,
        )

    def _processing_limits(self) -> dict[str, int]:
        return {
            "max_zip_bytes": self.settings.APP_MAX_UPLOAD_MB * 1024 * 1024,
            "max_file_bytes": self.settings.APP_MAX_TEXT_FILE_MB * 1024 * 1024,
            "max_files": self.settings.APP_MAX_PROCESSED_FILES,
        }

    def _supported_extensions(self) -> list[str]:
        return sorted(DOCUMENT_EXTENSIONS | CODE_EXTENSIONS)

    def list_artifacts(self, evaluation_id: str) -> list[ProjectArtifactRead]:
        self.get_evaluation(evaluation_id)
        return self.repository.list_artifacts(evaluation_id)

    def extract_context(self, evaluation_id: str) -> ExtractedProjectContextRead:
        self.get_evaluation(evaluation_id)
        if self.repository.has_sessions(evaluation_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="검증가 시작된 평가는 다시 분석할 수 없습니다.",
            )
        artifacts = self.repository.list_artifact_rows(evaluation_id)
        rag_status = self._build_rag_status(evaluation_id, artifacts)
        try:
            context = build_project_context(
                artifacts,
                llm=self._analysis_llm,
                cache_key=f"analysis:{evaluation_id}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "context_extraction",
                    "AI 프로젝트 분석 실패: LLM context 생성 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_ANALYSIS_MODEL,
                    rag_status=rag_status,
                ),
            ) from exc
        saved = self.repository.save_context(
            evaluation_id=evaluation_id,
            summary=str(context["summary"]),
            tech_stack=list(context["tech_stack"]),
            features=list(context["features"]),
            architecture=dict(context["architecture"]),
            student_implementation_risks=list(context["student_implementation_risks"]),
            structural_facts=dict(context["structural_facts"]),
            question_targets=list(context["question_targets"]),
            areas=list(context["areas"]),
            rag_status=rag_status,
        )
        self.repository.update_evaluation_status(
            evaluation_id, EvaluationStatus.ANALYZED
        )
        # extract 직후 품질 평가 자동 실행. 실패해도 saved context 는 보존하고,
        # status 응답이 has_quality_assessment=False 로 노출되어 운영자가 수동 재시도 가능.
        # 실패는 logger.exception 으로 명시적으로 기록 (silent fallback 금지).
        try:
            self.assess_project_quality(evaluation_id, context_read=saved)
        except HTTPException as exc:
            _logger.warning(
                "quality_assessment_failed_after_extract evaluation_id=%s detail=%s",
                evaluation_id,
                exc.detail,
            )
        except Exception:
            _logger.exception(
                "quality_assessment_unexpected_error evaluation_id=%s",
                evaluation_id,
            )
        return saved

    def assess_project_quality(
        self,
        evaluation_id: str,
        *,
        context_read: ExtractedProjectContextRead | None = None,
    ) -> ProjectQualityAssessmentRead:
        evaluation = self.get_evaluation(evaluation_id)
        context = context_read or self.repository.get_context(evaluation_id)
        if context is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "stage": "quality_assessment",
                    "reason": "context_missing",
                    "message": "프로젝트 분석이 끝난 뒤에만 품질 평가를 실행할 수 있습니다.",
                },
            )
        try:
            parsed = run_quality_assessment(
                self._analysis_llm,
                name=evaluation.name,
                project_category=evaluation.project_category.value,
                period_start=evaluation.evaluation_period_start,
                period_end=evaluation.evaluation_period_end,
                expected_participant_count=evaluation.expected_participant_count,
                focus_points=evaluation.focus_points or "",
                structural_facts=dict(context.structural_facts or {}),
                extracted_context=context.model_dump(mode="json"),
                cache_key=f"quality:{evaluation_id}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "quality_assessment",
                    "프로젝트 품질 평가 실패: LLM 응답 처리 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_ANALYSIS_MODEL,
                ),
            ) from exc
        return self.repository.save_quality_assessment(
            evaluation_id=evaluation_id,
            qualitative_grade=parsed.qualitative_grade,
            quantitative_score=parsed.quantitative_score,
            workload_baseline=parsed.workload_baseline,
            summary=parsed.summary,
            strengths=list(parsed.strengths),
            concerns=list(parsed.concerns),
            rationale=parsed.rationale,
            evidence_refs=list(parsed.evidence_refs),
            model_name=self.settings.OPENAI_ANALYSIS_MODEL,
        )

    def get_quality_assessment(
        self, evaluation_id: str
    ) -> ProjectQualityAssessmentRead:
        self.get_evaluation(evaluation_id)
        existing = self.repository.get_quality_assessment(evaluation_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "stage": "quality_assessment",
                    "reason": "not_yet_available",
                    "message": "프로젝트 품질 평가가 아직 준비되지 않았습니다.",
                },
            )
        return existing

    def _build_rag_status(self, evaluation_id: str, artifacts: list) -> dict[str, object]:
        if not self.settings.RAG_ENABLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "stage": "rag_ingestion",
                    "reason": "rag_disabled",
                    "message": "질문 생성에는 RAG 인덱싱이 필요합니다. RAG_ENABLED 설정을 확인하세요.",
                },
            )
        try:
            result = self._ingest_rag(evaluation_id, artifacts)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "rag_ingestion",
                    "RAG 인덱싱 중 외부 의존성 또는 벡터 저장소 오류가 발생했습니다.",
                    exc,
                    collection_name=self.settings.QDRANT_COLLECTION_NAME,
                    embedding_model=self.settings.OPENAI_EMBEDDING_MODEL,
                ),
            ) from exc
        return {
            "enabled": True,
            "status": "indexed",
            "inserted_count": result.inserted_count,
            "code_chunk_count": result.code_chunk_count,
            "document_chunk_count": result.document_chunk_count,
            "manifest_chunk_count": result.manifest_chunk_count,
            "skipped_count": result.skipped_count,
            "collection_name": self.settings.QDRANT_COLLECTION_NAME,
            "embedding_model": self.settings.OPENAI_EMBEDDING_MODEL,
        }

    def _ingest_rag(self, evaluation_id: str, artifacts: list):
        if self._openai is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="RAG 인덱싱에 필요한 OpenAI client가 초기화되지 않았습니다. OPENAI_API_KEY를 확인하세요.",
            )
        if self._qdrant is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="RAG 인덱싱에 필요한 Qdrant client가 초기화되지 않았습니다. QDRANT_URL을 확인하세요.",
            )
        from app.project_evaluations.rag.embedder import ingest_evaluation

        result = ingest_evaluation(
            evaluation_id=evaluation_id,
            artifacts=artifacts,
            openai_client=self._openai,
            qdrant_client=self._qdrant,
            collection_name=self.settings.QDRANT_COLLECTION_NAME,
            embedding_model=self.settings.OPENAI_EMBEDDING_MODEL,
        )
        if result.inserted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="RAG 인덱싱 결과 저장된 chunk가 없습니다. zip 내부 파일 형식, 텍스트 추출 결과, artifact role 분류를 확인하세요.",
            )
        return result

    def _make_retriever(self, evaluation_id: str) -> Callable[..., list] | None:
        if self._qdrant is None or self._openai is None:
            return None
        openai_client = self._openai
        qdrant_client = self._qdrant
        collection_name = self.settings.QDRANT_COLLECTION_NAME
        embedding_model = self.settings.OPENAI_EMBEDDING_MODEL

        def retriever(query: str, **kwargs: object) -> list:
            from app.project_evaluations.rag.retriever import retrieve_chunks

            return retrieve_chunks(
                query=query,
                evaluation_id=evaluation_id,
                openai_client=openai_client,
                qdrant_client=qdrant_client,
                collection_name=collection_name,
                embedding_model=embedding_model,
                artifact_roles=kwargs.get("artifact_roles"),
                chunk_types=kwargs.get("chunk_types"),
                source_types=kwargs.get("source_types"),
                top_k=int(kwargs.get("top_k", 5)),
            )

        return retriever

    def get_context(self, evaluation_id: str) -> ExtractedProjectContextRead:
        self.get_evaluation(evaluation_id)
        context = self.repository.get_context(evaluation_id)
        if context is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="아직 프로젝트 context가 생성되지 않았습니다.",
            )
        return context

    def generate_questions(self, evaluation_id: str) -> list[InterviewQuestionRead]:
        self.get_context(evaluation_id)
        if self.repository.has_sessions(evaluation_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="검증가 시작된 평가는 질문을 다시 생성할 수 없습니다.",
            )
        context_row = self.repository.get_context_row(evaluation_id)
        if context_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="아직 프로젝트 context가 생성되지 않았습니다.",
            )
        if self.settings.RAG_ENABLED:
            self._ensure_rag_ready(context_row)
        artifact_rows = self.repository.list_artifact_rows(evaluation_id)
        area_rows = self.repository.list_area_rows(evaluation_id)
        question_policy = self.repository.get_question_policy(evaluation_id)
        retriever = self._make_retriever(evaluation_id) if self.settings.RAG_ENABLED else None
        try:
            questions = generate_questions(
                evaluation_id,
                area_rows,
                context=context_row,
                artifacts=artifact_rows,
                llm=self._question_llm,
                retriever=retriever,
                require_rag=self.settings.RAG_ENABLED,
                question_policy=question_policy,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "question_generation",
                    "AI 질문 생성 실패: LLM 또는 RAG 검색 처리 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_QUESTION_MODEL,
                    rag_status=from_json(context_row.rag_status_json, {}),
                ),
            ) from exc
        if not questions:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "stage": "question_generation",
                    "reason": "no_questions_generated",
                    "message": "질문 생성 결과가 비어 있습니다.",
                    "check_targets": [
                        "LLM 응답 schema",
                        "question_policy",
                        "RAG 검색 결과",
                        "source ref 검증",
                    ],
                    "rag_status": from_json(context_row.rag_status_json, {}),
                },
            )
        saved = self.repository.save_questions(evaluation_id, questions)
        if len(saved) != len(questions):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail={
                    "stage": "question_persistence",
                    "reason": "question_save_count_mismatch",
                    "message": "생성된 질문 수와 저장된 질문 수가 일치하지 않습니다.",
                    "generated_count": len(questions),
                    "saved_count": len(saved),
                    "check_targets": ["DB 저장 상태", "질문 source refs", "질문 order_index"],
                },
            )
        self.repository.update_evaluation_status(
            evaluation_id, EvaluationStatus.QUESTIONS_GENERATED
        )
        return saved

    def _ensure_rag_ready(self, context_row) -> None:
        from app.project_evaluations.persistence.repository import from_json

        rag_status = from_json(context_row.rag_status_json, {})
        if rag_status.get("status") == "indexed":
            return
        if rag_status.get("status") == "failed":
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "stage": "question_generation",
                    "reason": "rag_ingestion_failed",
                    "message": "질문 생성 실패: RAG 인덱싱이 실패했습니다.",
                    "rag_status": rag_status,
                },
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "stage": "question_generation",
                "reason": "rag_not_ready",
                "message": "질문 생성 실패: RAG 인덱스가 준비되지 않았습니다. 먼저 프로젝트 분석을 완료하세요.",
                "rag_status": rag_status,
            },
        )

    def list_questions(self, evaluation_id: str) -> list[InterviewQuestionRead]:
        self.get_evaluation(evaluation_id)
        return self.repository.list_questions(evaluation_id)

    def join_evaluation(
        self,
        evaluation_id: str,
        participant_name: str,
        client_id: str = "local",
    ) -> JoinEvaluationRead:
        row = self.repository.get_evaluation_row(evaluation_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="프로젝트 평가를 찾을 수 없습니다.",
            )
        self._ensure_questions_ready_for_join(evaluation_id)
        session = self._create_session(evaluation_id, participant_name.strip())
        evaluation = self.get_evaluation(evaluation_id)
        token_qs = quote(session.session_token, safe="")
        return JoinEvaluationRead(
            evaluation=evaluation,
            session=session,
            interview_url_path=(
                f"/interview/{evaluation_id}/{session.id}/enter"
                f"?session_token={token_qs}"
            ),
        )

    def create_session(
        self,
        evaluation_id: str,
        participant_name: str = "",
    ) -> InterviewSessionRead:
        self.get_evaluation(evaluation_id)
        return self._create_session(evaluation_id, participant_name)

    def _create_session(
        self, evaluation_id: str, participant_name: str = ""
    ) -> InterviewSessionRead:
        self.get_evaluation(evaluation_id)
        self._ensure_questions_ready_for_join(evaluation_id)
        session_token = _new_session_token()
        session = self.repository.create_session(
            evaluation_id,
            participant_name,
            session_token_hash=_hash_password(session_token),
            session_token=session_token,
        )
        self.repository.update_evaluation_status(
            evaluation_id, EvaluationStatus.INTERVIEWING
        )
        return session

    def _ensure_questions_ready_for_join(self, evaluation_id: str) -> None:
        question_count = len(self.repository.list_question_rows(evaluation_id))
        expected_count = self.repository.get_question_policy(evaluation_id).total_question_count
        if question_count == expected_count and question_count > 0:
            return
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "stage": "join",
                "reason": "questions_not_ready",
                "message": "검증를 시작하기 전에 질문 정책에 맞는 질문을 먼저 생성해야 합니다.",
                "question_count": question_count,
                "expected_question_count": expected_count,
            },
        )

    def submit_turn(
        self,
        evaluation_id: str,
        session_id: str,
        payload: InterviewTurnCreate,
        session_token: str | None = None,
        client_id: str = "local",
        allow_follow_up_required: bool = False,
        follow_up_question: str | None = None,
        follow_up_reason: str = "",
        conversation_history: QuestionExchange | None = None,
    ) -> InterviewTurnRead:
        session = self.ensure_session(evaluation_id, session_id, session_token, client_id)
        question = self.repository.get_question_row(payload.question_id)
        if question is None or question.evaluation_id != evaluation_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="질문을 찾을 수 없습니다.",
            )
        if session.status.value == "completed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 완료된 검증입니다.",
            )
        if question.order_index != session.current_question_index:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="현재 순서의 질문에만 답변할 수 있습니다.",
            )
        if self.repository.has_turn_for_question(session_id, payload.question_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 답변한 질문입니다.",
            )

        current_exchange = conversation_history or QuestionExchange(
            student_answer=payload.answer_text.strip() or "(답변 없음)"
        )
        current_history_text = conversation_history_text(current_exchange)
        follow_up_count = len(current_exchange.follow_ups)
        # 꼬리질문 에이전트(JUDGE/FOLLOW_UP/FINALIZE)에 학생 프로젝트 좌표를 주입한다.
        # 없으면 빈 문자열이라 프롬프트에서 섹션 자체가 생략된다.
        project_context_brief = build_project_context_brief(
            self.repository.get_context(evaluation_id)
        )

        try:
            evaluation = evaluate_answer(
                question,
                payload.answer_text,
                llm=self._eval_llm,
                conversation_history=current_history_text,
                follow_up_count=follow_up_count,
                project_context_brief=project_context_brief,
            )
            if evaluation["needs_follow_up"]:
                if not allow_follow_up_required:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail={
                            "stage": "interview_turn",
                            "reason": "follow_up_required",
                            "message": "현재 답변은 꼬리질문 확인 후 저장해야 합니다.",
                            "follow_up_question": evaluation["follow_up_question"],
                            "follow_up_reason": evaluation["follow_up_reason"],
                        },
                    )
                # R1 통합: 별도 finalize 콜 대신 evaluate_answer 를 force_finalize=True 로 재호출.
                # judge_answer 가 used_rubric_indices 에 전체 인덱스를 주입해 needs_follow_up=false
                # 분기를 강제로 받는다. (judge 통합 1콜 + force_finalize 1콜 = 총 2콜.
                # 기존: judge + follow_up_q + finalize = 3콜)
                evaluation = evaluate_answer(
                    question,
                    payload.answer_text,
                    llm=self._eval_llm,
                    conversation_history=current_history_text,
                    follow_up_count=follow_up_count,
                    project_context_brief=project_context_brief,
                    force_finalize=True,
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "answer_evaluation",
                    "AI 답변 평가 실패: LLM 평가 처리 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_EVAL_MODEL,
                    question_id=payload.question_id,
                ),
            ) from exc
        try:
            return self.repository.create_turn(
                session_id=session_id,
                question=question,
                answer_text=payload.answer_text,
                score=float(evaluation["score"]),
                evaluation_summary=str(evaluation["evaluation_summary"]),
                rubric_scores=list(evaluation["rubric_scores"]),
                evidence_matches=list(evaluation["evidence_matches"]),
                evidence_mismatches=list(evaluation["evidence_mismatches"]),
                weaknesses=list(evaluation["weaknesses"]),
                strengths=list(evaluation["strengths"]),
                follow_up_question=follow_up_question or evaluation.get("follow_up_question"),
                follow_up_reason=follow_up_reason or str(evaluation.get("follow_up_reason", "")),
                finalized_score=float(evaluation["score"]),
                conversation_history=current_exchange,
            )
        except IntegrityError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 답변한 질문입니다.",
            ) from exc

    def preview_follow_up_question(
        self,
        evaluation_id: str,
        session_id: str,
        question_order_index: int,
        exchange: QuestionExchange,
        session_token: str | None = None,
        client_id: str = "local",
    ) -> dict[str, str] | None:
        self.ensure_session(evaluation_id, session_id, session_token, client_id)
        questions = self.repository.list_question_rows(evaluation_id)
        if question_order_index < 0 or question_order_index >= len(questions):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="꼬리질문을 생성할 질문 순서가 올바르지 않습니다.",
            )
        current_history_text = (
            conversation_history_text(exchange) if exchange.follow_ups else ""
        )
        # 루브릭 항목당 꼬리질문은 한 세션에서 최대 1회만 출제한다.
        # 이미 출제된 항목 index를 모아 evaluator에 전달 → judge가 후보에서 제외.
        used_rubric_indices = [
            int(fu.target_rubric_index)
            for fu in exchange.follow_ups
            if fu.target_rubric_index is not None
        ]
        project_context_brief = build_project_context_brief(
            self.repository.get_context(evaluation_id)
        )
        try:
            evaluation = evaluate_answer(
                questions[question_order_index],
                exchange.student_answer.strip() or "(답변 없음)",
                llm=self._eval_llm,
                conversation_history=current_history_text,
                follow_up_count=len(exchange.follow_ups),
                used_rubric_indices=used_rubric_indices,
                project_context_brief=project_context_brief,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "follow_up_generation",
                    "AI 꼬리질문 생성 실패: LLM 평가 처리 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_EVAL_MODEL,
                    question_id=questions[question_order_index].id,
                ),
            ) from exc
        if not evaluation.get("needs_follow_up"):
            return None
        follow_up = str(evaluation.get("follow_up_question") or "").strip()
        if not follow_up:
            return None
        target_index_raw = evaluation.get("target_rubric_index")
        if target_index_raw is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="꼬리질문이 생성되었지만 target_rubric_index가 비어 있습니다.",
            )
        return {
            "question": follow_up,
            "reason": str(evaluation.get("follow_up_reason") or "").strip(),
            "target_rubric_index": int(target_index_raw),
        }

    def list_turns(
        self,
        evaluation_id: str,
        session_id: str,
        session_token: str | None = None,
        client_id: str = "local",
    ) -> list[InterviewTurnRead]:
        self.ensure_session(evaluation_id, session_id, session_token, client_id)
        return self.repository.list_turns(session_id)

    def _conversation_history(self, session_id: str) -> str:
        turns = self.repository.list_turn_rows(session_id)
        parts = []
        for index, turn in enumerate(turns, start=1):
            parts.append(
                f"### 이전 턴 {index}\n"
                f"Q: {turn.question_text}\n"
                f"A: {turn.answer_text}\n"
                f"평가 요약: {turn.evaluation_summary}"
            )
        return "\n\n".join(parts)

    def complete_session(
        self,
        evaluation_id: str,
        session_id: str,
        session_token: str | None = None,
        client_id: str = "local",
    ) -> EvaluationReportRead:
        session = self.ensure_session(evaluation_id, session_id, session_token, client_id)
        if session.status.value == "completed":
            existing_report = self.repository.get_latest_report_for_session(session_id)
            if existing_report is not None:
                return existing_report
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 완료된 검증입니다.",
            )
        questions = self.repository.list_question_rows(evaluation_id)
        turns = self.repository.list_turn_rows(session_id)
        if len(turns) != len(questions):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "stage": "report_generation",
                    "reason": "turn_count_mismatch",
                    "message": "모든 질문에 정확히 한 번씩 답변한 뒤 검증를 완료할 수 있습니다.",
                    "question_count": len(questions),
                    "turn_count": len(turns),
                },
            )

        questions_by_id = {question.id: question for question in questions}
        # 평가 완료 시 모든 turn 의 최종 채점을 다시 도는 루프. 동일 평가이므로
        # 프로젝트 좌표는 루프 밖에서 1회만 빌드해 모든 finalize 호출에 재사용한다.
        project_context_brief = build_project_context_brief(
            self.repository.get_context(evaluation_id)
        )
        try:
            for turn in turns:
                question = questions_by_id.get(turn.question_id)
                if question is None:
                    raise RuntimeError(f"최종 채점 대상 질문을 찾을 수 없습니다. question_id={turn.question_id}")
                conversation_data = from_json(turn.conversation_history_json, {})
                if conversation_data:
                    follow_ups = [
                        FollowUpExchange(**item)
                        for item in conversation_data.get("follow_ups", [])
                    ]
                    exchange = QuestionExchange(
                        student_answer=str(conversation_data.get("student_answer", "")),
                        follow_ups=follow_ups,
                    )
                else:
                    exchange = QuestionExchange(
                        student_answer=turn.answer_text.strip() or "(답변 없음)"
                    )
                # R1 통합: 별도 finalize 콜 대신 evaluate_answer 를 force_finalize=True 로 호출.
                finalized = evaluate_answer(
                    question,
                    turn.answer_text,
                    llm=self._eval_llm,
                    conversation_history=conversation_history_text(exchange),
                    follow_up_count=len(exchange.follow_ups),
                    project_context_brief=project_context_brief,
                    force_finalize=True,
                )
                self.repository.update_turn_evaluation(
                    turn.id,
                    score=float(finalized["score"]),
                    evaluation_summary=str(finalized["evaluation_summary"]),
                    rubric_scores=list(finalized["rubric_scores"]),
                    evidence_matches=list(finalized["evidence_matches"]),
                    evidence_mismatches=list(finalized["evidence_mismatches"]),
                    weaknesses=list(finalized["weaknesses"]),
                    strengths=list(finalized["strengths"]),
                    finalized_score=float(finalized["score"]),
                )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "answer_finalize",
                    "AI 최종 채점 실패: finalize rubric 평가 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_EVAL_MODEL,
                ),
            ) from exc

        areas = self.repository.list_area_rows(evaluation_id)
        turns = self.repository.list_turn_rows(session_id)
        rubric_scores_by_turn = self.repository.rubric_scores_by_turn([turn.id for turn in turns])
        try:
            report = generate_report_payload(
                areas,
                questions,
                turns,
                llm=self._report_llm,
                rubric_scores_by_turn=rubric_scores_by_turn,
                cache_key=f"report:{evaluation_id}",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=_stage_error_detail(
                    "report_generation",
                    "AI 최종 리포트 생성 실패: LLM 리포트 작성 중 오류가 발생했습니다.",
                    exc,
                    llm_model=self.settings.OPENAI_EVAL_MODEL,
                ),
            ) from exc
        return self.repository.save_completed_report(
            evaluation_id=evaluation_id,
            session_id=session_id,
            final_decision=report["final_decision"],
            authenticity_score=float(report["authenticity_score"]),
            total_score=float(report["total_score"]),
            total_max_score=float(report["total_max_score"]),
            summary=str(report["summary"]),
            area_analyses=list(report["area_analyses"]),
            question_evaluations=list(report["question_evaluations"]),
            bloom_summary=list(report["bloom_summary"]),
            strengths=list(report["strengths"]),
            weaknesses=list(report["weaknesses"]),
        )

    def abort_session(
        self,
        evaluation_id: str,
        session_id: str,
        session_token: str | None = None,
        client_id: str = "local",
    ) -> EvaluationReportRead:
        """학생 조기 종료. 검증 진행 단계(의도 분류·꼬리질문 등) 없이 남은
        질문을 즉시 미응답으로 채우고, 지금까지 수집된 turn 데이터로
        ``complete_session``을 통해 정상 평가 리포트를 생성한다.
        """
        session = self.ensure_session(evaluation_id, session_id, session_token, client_id)
        if session.status.value == "completed":
            existing_report = self.repository.get_latest_report_for_session(session_id)
            if existing_report is not None:
                return existing_report
        while True:
            session = self.ensure_session(
                evaluation_id, session_id, session_token, client_id
            )
            questions = self.repository.list_question_rows(evaluation_id)
            if session.current_question_index >= len(questions):
                break
            question_id = questions[session.current_question_index].id
            self.submit_turn(
                evaluation_id,
                session_id,
                InterviewTurnCreate(
                    question_id=question_id,
                    answer_text=_ABORT_UNANSWERED_TEXT,
                ),
                session_token,
                client_id,
                allow_follow_up_required=True,
            )
        return self.complete_session(evaluation_id, session_id, session_token, client_id)

    def get_latest_report(self, evaluation_id: str) -> EvaluationReportRead:
        self.get_evaluation(evaluation_id)
        report = self.repository.get_latest_report(evaluation_id)
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="아직 생성된 리포트가 없습니다.",
            )
        return report

    def list_sessions(self, evaluation_id: str) -> list[InterviewSessionRead]:
        self.get_evaluation(evaluation_id)
        return self.repository.list_sessions_for_evaluation(evaluation_id)

    def list_reports(self, evaluation_id: str) -> list[EvaluationReportRead]:
        self.get_evaluation(evaluation_id)
        return self.repository.list_reports_for_evaluation(evaluation_id)

    def get_report(self, evaluation_id: str, report_id: str) -> EvaluationReportRead:
        self.get_evaluation(evaluation_id)
        report = self.repository.get_report(report_id)
        if report is None or report.evaluation_id != evaluation_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="리포트를 찾을 수 없습니다.",
            )
        return report

    def ensure_session(
        self,
        evaluation_id: str,
        session_id: str,
        session_token: str | None = None,
        client_id: str = "local",
    ) -> InterviewSessionRead:
        session_row = self.repository.get_session_row(session_id)
        if session_row is None or session_row.evaluation_id != evaluation_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="검증 세션을 찾을 수 없습니다.",
            )
        if not session_row.session_token_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="검증 세션 토큰이 설정되지 않은 기존 세션입니다. 새로 입장하세요.",
            )
        _check_auth_attempt("session", evaluation_id, f"{session_id}:{client_id}")
        if not _verify_password(session_token or "", session_row.session_token_hash):
            _record_auth_failure("session", evaluation_id, f"{session_id}:{client_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="검증 세션 토큰이 올바르지 않습니다.",
            )
        _clear_auth_failures("session", evaluation_id, f"{session_id}:{client_id}")
        return self.repository.to_session_read(session_row)
