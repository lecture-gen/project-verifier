"""마법사 1단계: 평가 메타 정보 입력 + 평가 객체 생성.

zip은 받지 않는다. 1단계 제출 시 POST /api/project-evaluations/ 로 평가 ID를 확보한다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import create_evaluation
from apps.streamlit.components.page_guard import mark_wizard_step_completed
from apps.streamlit.components.wizard_progress import render_wizard_progress
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_ADMIN_VERIFIED,
    KEY_EVALUATION,
    KEY_EVALUATION_ID,
    KEY_ROOM_PASSWORD,
    KEY_WIZARD_INFO,
    init_state,
    reset_wizard,
)
from apps.streamlit.ui_helpers import call_api


init_state()
render_wizard_progress(current_step=1)

st.header("1단계 · 평가 정보 입력")
st.caption("방 이름과 지원자 정보, 학생 입장/관리자 비밀번호를 입력하세요. 자료(zip)는 다음 단계에서 업로드합니다.")

if st.button("← 홈으로"):
    st.switch_page("Home.py")

current_eval_id = str(st.session_state.get(KEY_EVALUATION_ID) or "")
if current_eval_id:
    st.info(
        f"이 마법사는 이미 평가 ID `{current_eval_id}` 와 연결되어 있습니다. "
        "새 평가를 만들려면 아래 '마법사 초기화'를 눌러주세요."
    )
    if st.button("마법사 초기화"):
        reset_wizard()
        st.rerun()

defaults = st.session_state.get(KEY_WIZARD_INFO) or {}

with st.form("wizard_info_form"):
    room_name = st.text_input(
        "방/시험 이름",
        value=str(defaults.get("room_name", "")),
        placeholder="예: 캡스톤 4조 프로젝트 검증",
    )
    project_name = st.text_input(
        "프로젝트명",
        value=str(defaults.get("project_name", "")),
        placeholder="예: 프로젝트 수행 진위 평가 서비스",
    )
    candidate_name = st.text_input(
        "지원자/팀 라벨",
        value=str(defaults.get("candidate_name", "")),
        placeholder="예: 4조",
    )
    description = st.text_area(
        "프로젝트 설명",
        value=str(defaults.get("description", "")),
        placeholder="핵심 기능과 제출 자료 범위를 간단히 입력하세요.",
    )
    room_password = st.text_input("학생 입장 비밀번호", type="password")
    admin_password = st.text_input("관리자 비밀번호", type="password")
    submitted = st.form_submit_button("다음 → 자료 업로드", type="primary")

if submitted:
    if not project_name or not room_password or not admin_password:
        st.warning("프로젝트명, 학생 입장 비밀번호, 관리자 비밀번호를 모두 입력하세요.")
    else:
        info = {
            "room_name": room_name or project_name,
            "project_name": project_name,
            "candidate_name": candidate_name,
            "description": description,
        }
        st.session_state[KEY_WIZARD_INFO] = info

        with st.spinner("평가 객체를 생성합니다..."):
            evaluation = call_api(
                create_evaluation,
                project_name,
                candidate_name,
                description,
                info["room_name"],
                room_password,
                admin_password,
                None,
            )
        if evaluation:
            st.session_state[KEY_EVALUATION] = evaluation
            st.session_state[KEY_EVALUATION_ID] = str(evaluation["id"])
            st.session_state[KEY_ADMIN_PASSWORD] = admin_password
            st.session_state[KEY_ROOM_PASSWORD] = room_password
            st.session_state[KEY_ADMIN_VERIFIED] = True
            mark_wizard_step_completed(1)
            st.success(f"평가 생성 완료 · ID: {evaluation['id']}")
            st.switch_page("pages/11_wizard_2_upload.py")
