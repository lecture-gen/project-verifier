"""마법사 단계 진입 가드.

session_state에 임시 가드를 끼워넣지 않고, 각 페이지가 진입 시점에
필요한 전제 조건을 명시적으로 검증한 다음 부족하면 직전 단계로 redirect.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_ADMIN_VERIFIED,
    KEY_EVALUATION,
    KEY_EVALUATION_ID,
    KEY_UPLOAD_RESULT,
    KEY_WIZARD_COMPLETED_STEP,
)


def require_evaluation(min_step: int, fallback_page: str) -> None:
    """평가가 생성되어 있고, 마법사가 min_step 단계 이상 완료된 상태여야 통과.

    조건 미충족 시 fallback_page로 redirect.
    """
    evaluation_id = str(st.session_state.get(KEY_EVALUATION_ID, ""))
    admin_password = str(st.session_state.get(KEY_ADMIN_PASSWORD, ""))
    completed_step = int(st.session_state.get(KEY_WIZARD_COMPLETED_STEP, 0) or 0)
    if not evaluation_id or not admin_password or completed_step < min_step:
        st.warning(
            f"마법사 {min_step}단계로 진입하려면 이전 단계를 먼저 완료해야 합니다. "
            "직전 단계로 돌아갑니다."
        )
        st.switch_page(fallback_page)
        st.stop()


def require_admin_session(fallback_page: str = "pages/01_room_list.py") -> None:
    """방 관리 페이지가 evaluation_id + admin_verified 상태로 진입했는지 검증."""
    if not st.session_state.get(KEY_ADMIN_VERIFIED) or not st.session_state.get(
        KEY_EVALUATION
    ):
        st.switch_page(fallback_page)
        st.stop()


def mark_wizard_step_completed(step: int) -> None:
    """현재 단계를 완료로 표시(이전 진행보다 더 큰 값만 갱신)."""
    current = int(st.session_state.get(KEY_WIZARD_COMPLETED_STEP, 0) or 0)
    if step > current:
        st.session_state[KEY_WIZARD_COMPLETED_STEP] = step


def require_upload_result(fallback_page: str = "pages/11_wizard_2_upload.py") -> None:
    if not isinstance(st.session_state.get(KEY_UPLOAD_RESULT), dict):
        st.warning("자료 업로드가 먼저 필요합니다. 2단계로 돌아갑니다.")
        st.switch_page(fallback_page)
        st.stop()
