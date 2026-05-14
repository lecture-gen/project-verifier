"""방 카드 컴포넌트.

방 목록 페이지에서 사용한다. 카드 클릭 시 session_state에 평가 ID를 저장하고
방 관리 페이지로 전환한다.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import streamlit as st

from apps.streamlit.state import KEY_ADMIN_PASSWORD, KEY_ADMIN_VERIFIED, KEY_EVALUATION, KEY_EVALUATION_ID
from apps.streamlit.ui_helpers import EVALUATION_STATUS_LABELS, display_value


def _format_datetime(value: object) -> str:
    if not value:
        return "-"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    text = str(value)
    if "T" in text:
        text = text.split(".", 1)[0].replace("T", " ")
    return text[:16] if len(text) >= 16 else text


def render_evaluation_card(
    summary: dict[str, Any],
    *,
    on_click_page: str = "pages/02_room_manage.py",
) -> None:
    evaluation_id = str(summary.get("id", ""))
    room_name = display_value(summary.get("room_name") or summary.get("project_name"))
    project_name = display_value(summary.get("project_name"))
    candidate_name = display_value(summary.get("candidate_name"))
    raw_status = str(summary.get("status", ""))
    status_label = EVALUATION_STATUS_LABELS.get(raw_status, raw_status or "-")
    question_count = int(summary.get("question_count", 0) or 0)
    created_at = _format_datetime(summary.get("created_at"))

    with st.container(border=True):
        st.markdown(f"### {room_name}")
        st.caption(f"프로젝트: {project_name} · 지원자: {candidate_name}")
        cols = st.columns(3)
        cols[0].metric("상태", status_label)
        cols[1].metric("질문 수", question_count)
        cols[2].metric("생성일", created_at)
        st.caption(f"평가 ID: `{evaluation_id}`")
        if st.button(
            "관리",
            key=f"manage_{evaluation_id}",
            type="primary",
            width="stretch",
        ):
            st.session_state[KEY_EVALUATION_ID] = evaluation_id
            st.session_state[KEY_EVALUATION] = {"id": evaluation_id, **summary}
            st.session_state[KEY_ADMIN_VERIFIED] = False
            st.session_state[KEY_ADMIN_PASSWORD] = ""
            st.switch_page(on_click_page)
