"""마법사 5단계: 학생 입장 URL + 평가 요약 + 관리 화면 이동 버튼."""

from __future__ import annotations

import streamlit as st

from apps.streamlit.components.page_guard import (
    mark_wizard_step_completed,
    require_evaluation,
)
from apps.streamlit.components.wizard_progress import render_wizard_progress
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_ADMIN_VERIFIED,
    KEY_EVALUATION,
    KEY_EVALUATION_ID,
    KEY_QUESTIONS,
    init_state,
)
from apps.streamlit.ui_helpers import display_value, public_student_entry_url


init_state()
require_evaluation(min_step=4, fallback_page="pages/13_wizard_4_questions.py")
mark_wizard_step_completed(5)
render_wizard_progress(current_step=5)

evaluation_id = str(st.session_state[KEY_EVALUATION_ID])
admin_password = str(st.session_state[KEY_ADMIN_PASSWORD])
evaluation = st.session_state.get(KEY_EVALUATION) or {}

st.header("5단계 · 학생 입장 URL 및 평가 요약")

student_url = public_student_entry_url(evaluation_id)
st.success("방 생성과 질문 준비가 완료되었습니다.")
col1, col2 = st.columns([1, 2])
col1.metric("평가 ID", evaluation_id)
with col2:
    st.markdown("**학생 입장 URL**")
    st.code(student_url, language=None)

st.info(
    "학생에게 위 학생 입장 URL, 평가 ID, 방 비밀번호를 함께 전달하세요. "
    "학생은 평가 ID와 방 비밀번호로 로그인 없이 입장합니다."
)

st.divider()
st.subheader("평가 요약")
meta_cols = st.columns(3)
meta_cols[0].metric("방 이름", display_value(evaluation.get("room_name")))
meta_cols[1].metric("프로젝트", display_value(evaluation.get("project_name")))
meta_cols[2].metric("지원자", display_value(evaluation.get("candidate_name")))

policy = evaluation.get("question_policy") or {}
if isinstance(policy, dict):
    st.markdown("**질문 정책**")
    st.json(
        {
            "total_question_count": policy.get("total_question_count"),
            "bloom_ratios": policy.get("bloom_ratios"),
            "bloom_distribution": policy.get("bloom_distribution"),
        }
    )

questions = st.session_state.get(KEY_QUESTIONS) or []
if isinstance(questions, list) and questions:
    st.markdown("**생성된 질문 목록 (요약)**")
    st.dataframe(
        [
            {
                "Q": index,
                "Bloom": display_value(item.get("bloom_level")),
                "검증 초점": display_value(item.get("verification_focus")),
            }
            for index, item in enumerate(questions, start=1)
        ],
        hide_index=True,
        width="stretch",
    )

st.divider()
action_cols = st.columns(2)
with action_cols[0]:
    if st.button("방 관리 화면으로", type="primary", width="stretch"):
        st.session_state[KEY_ADMIN_VERIFIED] = True
        st.switch_page("pages/02_room_manage.py")
with action_cols[1]:
    if st.button("홈으로 돌아가기", width="stretch"):
        st.switch_page("Home.py")
