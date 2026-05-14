"""마법사 2단계: zip 업로드 + LLM 요약 확인.

1단계에서 만든 평가 ID에 zip을 업로드하고, 분석(extract)을 트리거한 뒤
요약 결과를 즉시 보여준다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import (
    extract_evaluation,
    get_context,
    get_evaluation_status,
    list_questions,
    upload_zip,
)
from apps.streamlit.components.evidence_console import (
    refresh_evaluation_state,
    render_rag_status,
    render_status_console,
    show_artifact_breakdown,
)
from apps.streamlit.components.page_guard import (
    mark_wizard_step_completed,
    require_evaluation,
)
from apps.streamlit.components.wizard_progress import render_wizard_progress
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_CONTEXT,
    KEY_EVALUATION_ID,
    KEY_EVALUATION_STATUS,
    KEY_UPLOAD_RESULT,
    init_state,
)
from apps.streamlit.ui_helpers import call_api


init_state()
require_evaluation(min_step=1, fallback_page="pages/10_wizard_1_info.py")
render_wizard_progress(current_step=2)

evaluation_id = str(st.session_state[KEY_EVALUATION_ID])
admin_password = str(st.session_state[KEY_ADMIN_PASSWORD])

st.header("2단계 · 프로젝트 자료 업로드")
st.caption(
    "단일 zip 파일로 프로젝트 자료를 업로드합니다. 업로드 직후 LLM 분석을 자동으로 트리거합니다."
)
st.caption(f"평가 ID: `{evaluation_id}`")

if st.button("← 이전 (정보 수정)"):
    st.switch_page("pages/10_wizard_1_info.py")

upload_result = st.session_state.get(KEY_UPLOAD_RESULT)

if not isinstance(upload_result, dict):
    uploaded_file = st.file_uploader("프로젝트 자료 zip", type=["zip"])
    if uploaded_file is not None:
        if st.button("zip 업로드 및 분석 시작", type="primary"):
            with st.spinner("zip을 업로드하고 분석을 시작합니다..."):
                result = call_api(
                    upload_zip,
                    evaluation_id,
                    uploaded_file.name,
                    uploaded_file,
                    admin_password,
                )
            if result:
                st.session_state[KEY_UPLOAD_RESULT] = result
                with st.spinner("자료를 요약(extract)하는 중입니다..."):
                    context = call_api(extract_evaluation, evaluation_id, admin_password)
                if context:
                    st.session_state[KEY_CONTEXT] = context
                refresh_evaluation_state(
                    evaluation_id,
                    admin_password,
                    get_evaluation_status=get_evaluation_status,
                    get_context=get_context,
                    list_questions=list_questions,
                )
                st.rerun()
else:
    st.success("zip 업로드가 완료되었습니다.")
    show_artifact_breakdown(upload_result)

    if st.button("자료 다시 분석"):
        with st.spinner("자료를 요약하는 중입니다..."):
            context = call_api(extract_evaluation, evaluation_id, admin_password)
        if context:
            st.session_state[KEY_CONTEXT] = context
        refresh_evaluation_state(
            evaluation_id,
            admin_password,
            get_evaluation_status=get_evaluation_status,
            get_context=get_context,
            list_questions=list_questions,
        )
        st.rerun()

    context = st.session_state.get(KEY_CONTEXT)
    if isinstance(context, dict):
        st.divider()
        st.subheader("분석 요약")
        st.write(context.get("summary"))
        render_rag_status(context)
        col1, col2 = st.columns(2)
        with col1:
            with st.expander("기술 스택"):
                for item in context.get("tech_stack", []):
                    st.markdown(f"- {item}")
            with st.expander("주요 기능"):
                for item in context.get("features", []):
                    st.markdown(f"- {item}")
        with col2:
            with st.expander("프로젝트 영역"):
                for area in context.get("areas", []):
                    st.markdown(f"**{area.get('name', '-')}** — {area.get('summary', '-')}")
            with st.expander("리스크 포인트"):
                for item in context.get("risk_points", []):
                    st.markdown(f"- {item}")

    status = st.session_state.get(KEY_EVALUATION_STATUS)
    if isinstance(status, dict):
        st.divider()
        render_status_console(status)

    st.divider()
    can_proceed = isinstance(st.session_state.get(KEY_CONTEXT), dict)
    if st.button(
        "다음 → 질문 정책",
        type="primary",
        disabled=not can_proceed,
        help=None if can_proceed else "분석(context)이 생성된 후에 다음으로 진행할 수 있습니다.",
    ):
        mark_wizard_step_completed(2)
        st.switch_page("pages/12_wizard_3_policy.py")
