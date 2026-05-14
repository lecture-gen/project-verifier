"""학생/지원자 입장 페이지.

쿼리 파라미터 ?mode=student&evaluation_id=... 형태로도 진입한다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import join_evaluation
from apps.streamlit.state import KEY_JOINED_SESSION, init_state
from apps.streamlit.ui_helpers import call_api, public_interview_url, query_param_value


init_state()

st.header("학생/지원자: 방 입장")
if st.button("← 홈으로"):
    st.switch_page("Home.py")

with st.form("join_room_form"):
    evaluation_id = st.text_input(
        "평가/방 ID",
        value=query_param_value("evaluation_id"),
    )
    participant_name = st.text_input("이름/팀명", placeholder="예: 홍길동 또는 4조")
    room_password = st.text_input("방 비밀번호", type="password")
    submitted = st.form_submit_button("입장", type="primary")

if submitted:
    if not evaluation_id or not participant_name or not room_password:
        st.warning("평가 ID, 이름/팀명, 방 비밀번호를 모두 입력하세요.")
    else:
        joined = call_api(join_evaluation, evaluation_id, participant_name, room_password)
        if joined:
            st.session_state[KEY_JOINED_SESSION] = joined
            st.success("입장 완료")
            st.rerun()

joined = st.session_state.get(KEY_JOINED_SESSION)
if isinstance(joined, dict):
    session = joined.get("session", {})
    evaluation = joined.get("evaluation", {})
    path = str(joined.get("interview_url_path", ""))
    interview_url = public_interview_url(path)
    st.subheader("음성 프로젝트 인터뷰")
    st.caption(f"방: {evaluation.get('room_name', evaluation.get('project_name', '-'))}")
    st.success(f"세션 준비 완료 · 세션 ID: {session.get('id', '-')}")
    st.link_button("음성 인터뷰 시작", interview_url, type="primary")
