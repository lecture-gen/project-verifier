"""공용 UI helper: API 호출 래퍼, URL 빌더, 표시 helper.

여러 페이지에서 동일한 호출/표시 로직을 공유하기 위한 얇은 helper 묶음.
"""

from __future__ import annotations

import os
from typing import Any, Callable
from urllib.parse import urlencode

import streamlit as st

from apps.streamlit.api_client import ApiClientError


BLOOM_LEVELS = ["기억", "이해", "적용", "분석", "평가", "창안"]

REASON_LABELS = {
    "accepted": "추출 성공",
    "ignored": "무시됨",
    "empty_text": "텍스트 없음",
    "file_too_large": "용량 초과",
    "processed_file_limit": "처리 제한",
    "extract_failed": "실패",
    "unsupported_extension": "지원하지 않는 확장자",
    "ignored_path": "무시 경로",
}

DIFFICULTY_LABELS = {
    "easy": "쉬움",
    "medium": "보통",
    "hard": "어려움",
}

EVALUATION_STATUS_LABELS = {
    "created": "방 생성",
    "uploaded": "자료 업로드",
    "analyzed": "분석 완료",
    "questions_generated": "질문 생성",
    "interviewing": "인터뷰 중",
    "reported": "리포트 완료",
}


def calculate_bloom_distribution(
    total_questions: int, ratios: dict[str, int]
) -> dict[str, int]:
    ratio_sum = sum(ratios.values())
    if ratio_sum == 0:
        return {level: 0 for level in BLOOM_LEVELS}
    raw_counts = {
        level: total_questions * ratios[level] / ratio_sum for level in BLOOM_LEVELS
    }
    planned = {level: int(raw_counts[level]) for level in BLOOM_LEVELS}
    remaining = total_questions - sum(planned.values())
    remainders = sorted(
        BLOOM_LEVELS,
        key=lambda level: (
            -(raw_counts[level] - planned[level]),
            BLOOM_LEVELS.index(level),
        ),
    )
    for level in remainders[:remaining]:
        planned = {**planned, level: planned[level] + 1}
    return planned


def public_student_entry_url(evaluation_id: str) -> str:
    base_url = (
        os.getenv("PUBLIC_APP_BASE_URL")
        or os.getenv("PUBLIC_STREAMLIT_BASE_URL")
        or "http://localhost:8501"
    ).rstrip("/")
    query = urlencode({"mode": "student", "evaluation_id": evaluation_id})
    return f"{base_url}/?{query}"


def public_interview_url(path: str) -> str:
    base_url = (
        os.getenv("PUBLIC_APP_BASE_URL")
        or os.getenv("PUBLIC_INTERVIEW_BASE_URL")
        or "http://localhost:8000"
    ).rstrip("/")
    return f"{base_url}{path}"


def display_value(value: object) -> str:
    if value is None or value == "":
        return "-"
    if isinstance(value, list):
        return ", ".join(str(item) for item in value) if value else "-"
    return str(value)


def query_param_value(name: str) -> str:
    value = st.query_params.get(name, "")
    if isinstance(value, list):
        return str(value[0]) if value else ""
    return str(value)


def call_api(action: Callable[..., Any], *args: Any) -> Any:
    try:
        return action(*args)
    except ApiClientError as exc:
        render_api_error(exc)
        return None


def call_api_capture_error(
    action: Callable[..., Any], *args: Any
) -> tuple[Any, ApiClientError | None]:
    try:
        return action(*args), None
    except ApiClientError as exc:
        return None, exc


def fetch_api(action: Callable[..., Any], *args: Any) -> Any:
    try:
        return action(*args)
    except ApiClientError as exc:
        st.session_state["last_operation"] = str(exc)
        return None


def render_api_error(exc: ApiClientError) -> None:
    detail = exc.detail
    if isinstance(detail, dict):
        stage = detail.get("stage")
        reason = detail.get("reason")
        message = detail.get("message") or str(exc)
        st.error("진행 차단: FastAPI 요청이 실패했습니다.")
        if stage or reason:
            cols = st.columns(2)
            cols[0].metric("실패 단계", display_value(stage))
            cols[1].metric("실패 사유", display_value(reason))
        st.write(message)
        extra = {
            key: value
            for key, value in detail.items()
            if key not in {"stage", "reason", "message"}
        }
        if extra:
            with st.expander("상세 오류 정보"):
                st.json(extra)
        return
    if isinstance(detail, list):
        st.error("진행 차단: FastAPI 요청 검증에 실패했습니다.")
        with st.expander("검증 오류 상세", expanded=True):
            st.json(detail)
        return
    st.error(str(exc))


def render_persisted_generation_error(evaluation_id: str) -> None:
    error = st.session_state.get("question_generation_error")
    if not isinstance(error, dict) or error.get("evaluation_id") != evaluation_id:
        return
    detail = error.get("detail")
    st.error("질문 생성 API 요청이 실패했습니다.")
    if isinstance(detail, dict):
        stage = detail.get("stage")
        reason = detail.get("reason")
        message = detail.get("message") or error.get("message")
        cols = st.columns(2)
        cols[0].metric("실패 단계", display_value(stage))
        cols[1].metric("실패 사유", display_value(reason))
        st.write(message)
        check_targets = detail.get("check_targets", [])
        if isinstance(check_targets, list) and check_targets:
            st.markdown("**확인 대상**")
            for target in check_targets:
                st.markdown(f"- {target}")
        extra = {
            key: value
            for key, value in detail.items()
            if key not in {"stage", "reason", "message", "check_targets"}
        }
        if extra:
            with st.expander("질문 생성 실패 상세"):
                st.json(extra)
        return
    if isinstance(detail, list):
        with st.expander("질문 생성 검증 오류", expanded=True):
            st.json(detail)
        return
    st.write(display_value(error.get("message")))


def persist_question_generation_error(
    evaluation_id: str, exc: ApiClientError
) -> None:
    st.session_state["question_generation_error"] = {
        "evaluation_id": evaluation_id,
        "message": str(exc),
        "detail": exc.detail,
    }


def clear_question_generation_error() -> None:
    st.session_state["question_generation_event"] = None
    st.session_state["question_generation_error"] = None
