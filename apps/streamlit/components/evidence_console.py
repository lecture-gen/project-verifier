"""Evidence Console: 상태/질문/근거를 한 번에 검토하는 패널.

기존 Home.py의 render_status_console, render_question_console, render_rag_status,
show_artifact_breakdown 등을 페이지 간 재사용 가능한 단위로 모았다.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

import streamlit as st

from apps.streamlit.api_client import ApiClientError
from apps.streamlit.ui_helpers import (
    BLOOM_LEVELS,
    DIFFICULTY_LABELS,
    REASON_LABELS,
    call_api,
    call_api_capture_error,
    display_value,
    fetch_api,
)


def refresh_evaluation_state(
    evaluation_id: str,
    admin_password: str,
    *,
    get_evaluation_status,
    get_context,
    list_questions,
) -> dict[str, Any] | None:
    st.session_state["last_operation"] = ""
    st.session_state["evaluation_status"] = None
    st.session_state["context"] = None
    st.session_state["questions"] = []
    status = fetch_api(get_evaluation_status, evaluation_id, admin_password)
    if not isinstance(status, dict):
        return None
    st.session_state["evaluation_status"] = status
    if bool(status.get("has_context")):
        context = fetch_api(get_context, evaluation_id, admin_password)
        if isinstance(context, dict):
            st.session_state["context"] = context
    if int(status.get("question_count", 0) or 0) > 0:
        questions = fetch_api(list_questions, evaluation_id, admin_password)
        st.session_state["questions"] = questions if isinstance(questions, list) else []
    return status


def show_artifact_breakdown(upload_result: dict[str, object]) -> None:
    reason_counts = upload_result.get("reason_counts", {})
    if not isinstance(reason_counts, dict):
        reason_counts = {}
    metrics = [
        ("추출 성공", upload_result.get("accepted_count", reason_counts.get("accepted", 0))),
        ("무시됨", upload_result.get("ignored_count", reason_counts.get("ignored", 0))),
        ("텍스트 없음", upload_result.get("empty_text_count", reason_counts.get("empty_text", 0))),
        ("용량 초과", upload_result.get("file_too_large_count", reason_counts.get("file_too_large", 0))),
        ("처리 제한", upload_result.get("processed_file_limit_count", reason_counts.get("processed_file_limit", 0))),
        ("실패", upload_result.get("failed_count", reason_counts.get("extract_failed", 0))),
    ]
    cols = st.columns(6)
    for col, (label, value) in zip(cols, metrics, strict=False):
        col.metric(label, int(value or 0))

    st.info(
        "파일 처리 상태는 zip 내부 파일을 추출/분류한 결과입니다. "
        "무시됨은 분석 대상이 아닌 경로 또는 확장자, 텍스트 없음은 추출 가능한 본문 부재, "
        "용량 초과는 파일별 처리 한도 초과, 처리 제한은 최대 처리 파일 수 도달, "
        "실패는 텍스트 추출 중 오류가 발생한 경우를 의미합니다."
    )

    processing_limits = upload_result.get("processing_limits", {})
    if not isinstance(processing_limits, dict):
        processing_limits = {}
    supported_extensions = upload_result.get("supported_extensions", [])
    if not isinstance(supported_extensions, list):
        supported_extensions = []

    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for artifact in upload_result.get("artifacts", []):
        if not isinstance(artifact, dict):
            continue
        metadata = artifact.get("metadata", {})
        reason = "accepted" if artifact.get("status") == "extracted" else "unknown"
        if isinstance(metadata, dict):
            reason = str(metadata.get("reason", reason))
        if reason == "accepted":
            continue
        grouped[reason].append(artifact)

    with st.expander("파일 처리 사유 예시"):
        if not grouped:
            st.caption("표시할 제외/실패 예시가 없습니다.")
        for reason, artifacts in sorted(grouped.items()):
            st.markdown(f"**{REASON_LABELS.get(reason, reason)}**")
            for artifact in artifacts[:8]:
                if not isinstance(artifact, dict):
                    continue
                st.markdown(f"- `{artifact.get('source_path', '-')}`")
                detail = _processing_reason_detail(
                    artifact,
                    str(reason),
                    processing_limits,
                    supported_extensions,
                )
                if detail:
                    st.caption(detail)


def _processing_reason_detail(
    artifact: dict[str, object],
    reason: str,
    processing_limits: dict[str, object],
    supported_extensions: list[object],
) -> str:
    metadata = artifact.get("metadata", {})
    if not isinstance(metadata, dict):
        metadata = {}
    if reason == "file_too_large":
        size = metadata.get("size")
        limit = (
            metadata.get("limit")
            or processing_limits.get("max_text_file_bytes")
            or processing_limits.get("max_text_file_size")
            or processing_limits.get("APP_MAX_TEXT_FILE_MB")
        )
        return f"실제 size={display_value(size)}, limit={display_value(limit)}"
    if reason == "unsupported_extension":
        extension = metadata.get("extension")
        supported = metadata.get("supported_extensions") or supported_extensions
        return (
            f"extension={display_value(extension)}, "
            f"supported_extensions={display_value(supported)}"
        )
    return ""


def render_rag_status(context: dict[str, object]) -> None:
    rag_status = context.get("rag_status", {})
    if not isinstance(rag_status, dict) or not rag_status:
        st.caption("RAG 상태 정보가 없습니다.")
        return
    st.subheader("RAG 인덱싱 상태")
    if rag_status.get("enabled") is False:
        st.error(f"진행 차단: RAG 비활성화 · {rag_status.get('reason', '-')}")
        return
    if rag_status.get("status") == "failed":
        st.error("진행 차단: RAG 인덱싱 실패")
        st.write(rag_status.get("message") or rag_status.get("reason") or "원인을 확인할 수 없습니다.")
        with st.expander("RAG 실패 상세"):
            st.json(rag_status)
        return
    cols = st.columns(5)
    cols[0].metric("상태", str(rag_status.get("status", "-")))
    cols[1].metric("전체 chunk", int(rag_status.get("inserted_count", 0) or 0))
    cols[2].metric("code chunk", int(rag_status.get("code_chunk_count", 0) or 0))
    cols[3].metric("document chunk", int(rag_status.get("document_chunk_count", 0) or 0))
    cols[4].metric("manifest", int(rag_status.get("manifest_chunk_count", 0) or 0))
    st.caption(
        f"collection={rag_status.get('collection_name', '-')} · "
        f"embedding={rag_status.get('embedding_model', '-')}"
    )


def render_status_console(status: dict[str, object] | None) -> None:
    if not isinstance(status, dict):
        st.info("상태를 아직 불러오지 않았습니다. 방 생성 또는 관리자 확인 후 상태를 새로고침하세요.")
        return
    phase = str(status.get("phase", "-"))
    can_join = bool(status.get("can_join"))
    questions_ready = bool(status.get("questions_ready"))
    message = display_value(status.get("user_message"))
    if can_join:
        st.success(message)
    elif bool(status.get("retryable")):
        st.info(message)
    else:
        st.warning(message)

    rag_status = status.get("rag_status", {})
    rag_text = "-"
    if isinstance(rag_status, dict):
        rag_text = str(rag_status.get("status") or rag_status.get("reason") or "-")
    cols = st.columns(5)
    cols[0].metric("현재 단계", phase)
    cols[1].metric("저장 질문", int(status.get("question_count", 0) or 0))
    cols[2].metric("기대 질문", int(status.get("expected_question_count", 0) or 0))
    cols[3].metric("RAG", rag_text)
    cols[4].metric("입장 가능", "가능" if questions_ready and can_join else "대기")

    blocked_reason = str(status.get("blocked_reason", ""))
    check_targets = status.get("check_targets", [])
    if blocked_reason or check_targets:
        with st.expander("상태 판단 근거"):
            if blocked_reason:
                st.markdown(f"**차단 사유:** `{blocked_reason}`")
            if isinstance(check_targets, list) and check_targets:
                st.markdown("**확인 대상**")
                for target in check_targets:
                    st.markdown(f"- {target}")


def render_question_console(
    questions: list[dict[str, object]],
    status: dict[str, object] | None,
) -> None:
    st.subheader("Evidence Console")
    st.caption("질문 생성 여부와 각 질문의 코드·문서 근거를 한 번에 검토합니다.")
    render_status_console(status)
    if not questions:
        _render_question_empty_state(status)
        return

    overview_rows = []
    bloom_counts: Counter[str] = Counter()
    difficulty_counts: Counter[str] = Counter()
    source_paths = set()
    for index, question in enumerate(questions, start=1):
        refs = question.get("source_refs", [])
        refs_list = refs if isinstance(refs, list) else []
        grouped_refs = _group_source_refs_by_path(refs_list)
        code_refs = [ref for ref in refs_list if _is_code_ref(ref)]
        doc_refs = [ref for ref in refs_list if _is_document_ref(ref)]
        bloom_level = display_value(question.get("bloom_level"))
        difficulty = DIFFICULTY_LABELS.get(
            str(question.get("difficulty", "")),
            display_value(question.get("difficulty")),
        )
        bloom_counts[bloom_level] += 1
        difficulty_counts[difficulty] += 1
        source_paths.update(grouped_refs.keys())
        overview_rows.append(
            {
                "Q": index,
                "Bloom": bloom_level,
                "난이도": difficulty,
                "검증 초점": display_value(question.get("verification_focus")),
                "근거 수": len(refs_list),
                "code refs": len(code_refs),
                "doc refs": len(doc_refs),
            }
        )

    metric_cols = st.columns(4)
    metric_cols[0].metric("질문 수", len(questions))
    metric_cols[1].metric("Bloom 커버리지", f"{len([k for k, v in bloom_counts.items() if v])}/6")
    metric_cols[2].metric("근거 파일", len(source_paths))
    metric_cols[3].metric(
        "문서-코드 근거",
        "확보" if all(row["code refs"] and row["doc refs"] for row in overview_rows) else "확인 필요",
    )

    left, right = st.columns([0.9, 1.6])
    with left:
        st.markdown("#### 단계 rail")
        for phase, label in [
            ("created", "방 생성"),
            ("uploaded", "자료 업로드"),
            ("context_ready", "분석 완료"),
            ("questions_ready", "질문 저장"),
        ]:
            marker = "●" if isinstance(status, dict) and status.get("phase") == phase else "○"
            st.markdown(f"{marker} **{label}** `{phase}`")
        st.markdown("#### Bloom 분포")
        st.dataframe(
            [{"Bloom": level, "문항 수": bloom_counts.get(level, 0)} for level in BLOOM_LEVELS],
            hide_index=True,
            width="stretch",
        )
        st.markdown("#### 난이도 분포")
        st.dataframe(
            [{"난이도": key, "문항 수": value} for key, value in difficulty_counts.items()],
            hide_index=True,
            width="stretch",
        )
    with right:
        st.markdown("#### 질문 overview")
        st.dataframe(overview_rows, hide_index=True, width="stretch")
        selected = st.radio(
            "질문 dossier 선택",
            options=list(range(len(questions))),
            format_func=lambda index: f"Q{index + 1} · {display_value(questions[index].get('bloom_level'))}",
            horizontal=True,
        )
        _render_question_dossier(questions[int(selected)], int(selected) + 1)


def _render_question_empty_state(status: dict[str, object] | None) -> None:
    if not isinstance(status, dict):
        st.info("관리자 확인 후 DB 기준 질문 상태를 조회합니다.")
        return
    phase = str(status.get("phase", ""))
    if phase == "created":
        st.warning("아직 zip 자료가 업로드되지 않아 질문을 만들 수 없습니다.")
    elif phase == "uploaded":
        st.info("자료 업로드는 완료됐습니다. context 생성 및 질문 만들기 버튼으로 분석을 시작하세요.")
    elif phase in {"rag_not_ready", "indexing_failed"}:
        st.error(display_value(status.get("user_message")))
    elif phase == "context_ready":
        st.info("분석은 완료됐지만 아직 저장된 질문이 없습니다. 질문 생성을 실행하세요.")
    else:
        st.warning("DB에서 저장된 질문을 찾지 못했습니다. 상태를 새로고침하거나 질문 생성을 다시 실행하세요.")


def _render_question_dossier(question: dict[str, object], index: int) -> None:
    st.markdown(f"#### Q{index}. {display_value(question.get('question'))}")
    detail_cols = st.columns(2)
    with detail_cols[0]:
        st.markdown("**검증 의도**")
        st.write(display_value(question.get("intent")))
        st.markdown("**검증 초점**")
        st.write(display_value(question.get("verification_focus")))
    with detail_cols[1]:
        st.markdown("**기대 답변 신호**")
        st.write(display_value(question.get("expected_signal")))
        st.markdown("**기대 근거**")
        st.write(display_value(question.get("expected_evidence")))
    st.markdown("**Source ref 요구사항**")
    st.caption(display_value(question.get("source_ref_requirements")))

    refs = question.get("source_refs", [])
    grouped_refs = _group_source_refs_by_path(refs if isinstance(refs, list) else [])
    st.markdown("**근거 파일 맵**")
    if not grouped_refs:
        st.caption("연결된 source ref가 없습니다.")
        return
    for path, path_refs in grouped_refs.items():
        with st.expander(f"{path} · {len(path_refs)}개 근거", expanded=False):
            for ref in path_refs:
                location = _ref_location(ref)
                st.markdown(
                    f"- {location or '위치 정보 없음'} · "
                    f"{display_value(ref.get('artifact_role'))} / "
                    f"{display_value(ref.get('chunk_type'))}"
                )
                snippet = str(ref.get("snippet", "")).strip()
                if snippet:
                    st.caption(snippet)


def _group_source_refs_by_path(refs: list[object]) -> dict[str, list[dict[str, object]]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for ref in refs:
        if isinstance(ref, dict):
            grouped[str(ref.get("path", "-"))].append(ref)
    return dict(grouped)


def _ref_location(ref: dict[str, object]) -> str:
    if ref.get("line_start") and ref.get("line_end"):
        return f":L{ref['line_start']}-L{ref['line_end']}"
    if ref.get("page_or_slide"):
        return f" ({ref['page_or_slide']})"
    return ""


def _is_code_ref(ref: object) -> bool:
    if not isinstance(ref, dict):
        return False
    return str(ref.get("artifact_role", "")) in {
        "codebase_source",
        "codebase_test",
        "codebase_config",
        "codebase_api_spec",
    }


def _is_document_ref(ref: object) -> bool:
    if not isinstance(ref, dict):
        return False
    role = str(ref.get("artifact_role", ""))
    return role == "codebase_overview" or role.startswith("project_")
