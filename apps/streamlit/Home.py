"""Streamlit 진입점.

`st.navigation(position="hidden")`으로 사이드바 페이지 목록을 숨기고,
홈 콘텐츠(교수자 섹션 + 학생 섹션)는 진입점 자체에서 렌더한다.
페이지 간 전환은 모두 `st.switch_page()`로 명시한다.
"""

from __future__ import annotations

import sys
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from apps.streamlit.api_client import ApiClientError, get_health
from apps.streamlit.state import init_state, reset_workspace
from apps.streamlit.ui_helpers import query_param_value


st.set_page_config(page_title="프로젝트 수행 진위 평가", layout="wide")
init_state()


def _render_sidebar() -> None:
    with st.sidebar:
        st.subheader("API 상태")
        try:
            health = get_health()
        except ApiClientError as exc:
            st.warning(str(exc))
            st.caption("FastAPI 서버: `uv run uvicorn app.main:app --reload`")
        else:
            st.success("연결됨")
            storage = health.get("storage", {})
            if isinstance(storage, dict):
                st.caption(f"SQLite: {storage.get('sqlite_path', '-')}")

        st.divider()
        if st.button("처음부터 다시 시작"):
            reset_workspace()


def render_home() -> None:
    """메인 홈: 교수자 섹션 + 학생 섹션을 좌/우로 직접 렌더."""
    # 학생 쿼리 파라미터 자동 redirect
    qmode = query_param_value("mode")
    if qmode == "student":
        st.switch_page("pages/20_student_join.py")
        return
    if qmode == "student_report":
        st.switch_page("pages/21_student_report.py")
        return

    _render_sidebar()

    st.title("프로젝트 수행 진위 평가")
    st.caption("자료 기반 질문으로 지원자가 프로젝트를 진짜 수행했는지 검증합니다.")

    professor_col, student_col = st.columns(2)
    with professor_col:
        with st.container(border=True):
            st.subheader("교수자")
            st.write("방을 만들고 zip 자료를 업로드한 뒤, 자료 기반 질문과 리포트를 관리합니다.")
            if st.button("새로운 방 만들기", type="primary", width="stretch"):
                st.switch_page("pages/10_wizard_1_info.py")
            if st.button("기존 방 관리", width="stretch"):
                st.switch_page("pages/01_room_list.py")
    with student_col:
        with st.container(border=True):
            st.subheader("학생/지원자")
            st.write("평가 ID와 방 비밀번호로 입장해 실시간 음성 인터뷰를 진행합니다.")
            if st.button("방 입장", width="stretch"):
                st.switch_page("pages/20_student_join.py")


_PAGES = [
    st.Page(render_home, title="홈", url_path="home", default=True),
    st.Page("pages/01_room_list.py", title="방 목록", url_path="rooms"),
    st.Page("pages/02_room_manage.py", title="방 관리", url_path="room-manage"),
    st.Page("pages/10_wizard_1_info.py", title="새 방 1단계", url_path="wizard-info"),
    st.Page("pages/11_wizard_2_upload.py", title="새 방 2단계", url_path="wizard-upload"),
    st.Page("pages/12_wizard_3_policy.py", title="새 방 3단계", url_path="wizard-policy"),
    st.Page("pages/13_wizard_4_questions.py", title="새 방 4단계", url_path="wizard-questions"),
    st.Page("pages/14_wizard_5_summary.py", title="새 방 5단계", url_path="wizard-summary"),
    st.Page("pages/20_student_join.py", title="학생 입장", url_path="student"),
    st.Page("pages/21_student_report.py", title="학생 리포트", url_path="student-report"),
]

_navigation = st.navigation(_PAGES, position="hidden")
_navigation.run()
