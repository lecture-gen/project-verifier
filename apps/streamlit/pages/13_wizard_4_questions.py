"""마법사 4단계: 질문 생성 + Evidence Console 검토."""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import (
    generate_questions,
    get_context,
    get_evaluation_status,
    list_questions,
)
from apps.streamlit.components.evidence_console import (
    refresh_evaluation_state,
    render_question_console,
)
from apps.streamlit.components.page_guard import (
    mark_wizard_step_completed,
    require_evaluation,
)
from apps.streamlit.components.wizard_progress import render_wizard_progress
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_EVALUATION_ID,
    KEY_EVALUATION_STATUS,
    KEY_QUESTIONS,
    init_state,
)
from apps.streamlit.ui_helpers import (
    call_api_capture_error,
    clear_question_generation_error,
    persist_question_generation_error,
    render_persisted_generation_error,
)


init_state()
require_evaluation(min_step=3, fallback_page="pages/12_wizard_3_policy.py")
render_wizard_progress(current_step=4)

evaluation_id = str(st.session_state[KEY_EVALUATION_ID])
admin_password = str(st.session_state[KEY_ADMIN_PASSWORD])

st.header("4단계 · 질문 검토")
st.caption("3단계 정책으로 질문을 생성하고, 코드/문서 근거를 검토합니다.")

if st.button("← 이전 (정책 수정)"):
    st.switch_page("pages/12_wizard_3_policy.py")

status = st.session_state.get(KEY_EVALUATION_STATUS)
if not isinstance(status, dict):
    refresh_evaluation_state(
        evaluation_id,
        admin_password,
        get_evaluation_status=get_evaluation_status,
        get_context=get_context,
        list_questions=list_questions,
    )
    status = st.session_state.get(KEY_EVALUATION_STATUS)

questions = st.session_state.get(KEY_QUESTIONS) or []
phase = str(status.get("phase", "")) if isinstance(status, dict) else ""
should_generate = phase == "context_ready"

action_cols = st.columns(2)
with action_cols[0]:
    if st.button(
        "질문 생성",
        type="primary",
        disabled=not should_generate,
        help=(
            None
            if should_generate
            else "분석(context)이 준비된 상태에서만 질문 생성을 실행할 수 있습니다."
        ),
    ):
        clear_question_generation_error()
        with st.spinner("자료 근거 기반 질문을 생성하는 중입니다..."):
            generated, gen_err = call_api_capture_error(
                generate_questions, evaluation_id, admin_password
            )
        if gen_err is not None:
            persist_question_generation_error(evaluation_id, gen_err)
        refresh_evaluation_state(
            evaluation_id,
            admin_password,
            get_evaluation_status=get_evaluation_status,
            get_context=get_context,
            list_questions=list_questions,
        )
        st.rerun()
with action_cols[1]:
    if st.button("상태 새로고침"):
        refresh_evaluation_state(
            evaluation_id,
            admin_password,
            get_evaluation_status=get_evaluation_status,
            get_context=get_context,
            list_questions=list_questions,
        )
        st.rerun()

render_persisted_generation_error(evaluation_id)

render_question_console(
    questions if isinstance(questions, list) else [],
    status if isinstance(status, dict) else None,
)

can_proceed = isinstance(questions, list) and len(questions) > 0
if st.button(
    "다음 → 학생 URL",
    type="primary",
    disabled=not can_proceed,
    help=None if can_proceed else "질문이 1개 이상 저장된 후에 다음으로 진행할 수 있습니다.",
):
    mark_wizard_step_completed(4)
    st.switch_page("pages/14_wizard_5_summary.py")
