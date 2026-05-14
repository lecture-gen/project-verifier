"""방 관리 페이지: admin_password 인증 후 Evidence Console 노출.

방 목록의 카드 클릭으로 session_state에 평가 ID가 미리 설정된 상태로 진입한다.
미인증 상태면 비밀번호 입력 폼만, 인증 후에는 상태/질문/리포트를 검토할 수 있다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import (
    extract_evaluation,
    generate_questions,
    get_context,
    get_evaluation_status,
    get_latest_report,
    list_questions,
    list_turns,
    verify_admin,
)
from apps.streamlit.components.evidence_console import (
    refresh_evaluation_state,
    render_question_console,
    render_rag_status,
)
from apps.streamlit.components.report import render_report
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_ADMIN_VERIFIED,
    KEY_CONTEXT,
    KEY_EVALUATION,
    KEY_EVALUATION_ID,
    KEY_EVALUATION_STATUS,
    KEY_JOINED_SESSION,
    KEY_LAST_OPERATION,
    KEY_QUESTIONS,
    KEY_REPORT,
    init_state,
)
from apps.streamlit.ui_helpers import (
    call_api,
    call_api_capture_error,
    clear_question_generation_error,
    persist_question_generation_error,
    public_student_entry_url,
    render_persisted_generation_error,
)


init_state()

if not str(st.session_state.get(KEY_EVALUATION_ID, "")):
    st.warning("관리할 방을 선택하지 않았습니다. 방 목록으로 돌아갑니다.")
    if st.button("방 목록으로"):
        st.switch_page("pages/01_room_list.py")
    st.stop()

evaluation_id = str(st.session_state[KEY_EVALUATION_ID])

st.header("방 관리")
st.caption(f"평가 ID: `{evaluation_id}`")

if st.button("← 방 목록"):
    st.switch_page("pages/01_room_list.py")

# ----- 인증 단계 -----
if not st.session_state.get(KEY_ADMIN_VERIFIED):
    st.subheader("관리자 인증")
    with st.form("room_admin_verify"):
        admin_password = st.text_input("관리자 비밀번호", type="password")
        submitted = st.form_submit_button("관리자 확인", type="primary")
    if submitted:
        if not admin_password:
            st.warning("관리자 비밀번호를 입력하세요.")
        else:
            verified = call_api(verify_admin, evaluation_id, admin_password)
            if verified:
                st.session_state[KEY_ADMIN_VERIFIED] = True
                st.session_state[KEY_ADMIN_PASSWORD] = admin_password
                clear_question_generation_error()
                refresh_evaluation_state(
                    evaluation_id,
                    admin_password,
                    get_evaluation_status=get_evaluation_status,
                    get_context=get_context,
                    list_questions=list_questions,
                )
                st.rerun()
    st.stop()

# ----- 관리 화면 -----
admin_password = str(st.session_state.get(KEY_ADMIN_PASSWORD, ""))
student_url = public_student_entry_url(evaluation_id)

col1, col2 = st.columns([1, 2])
col1.metric("평가 ID", evaluation_id)
with col2:
    st.markdown("**학생 입장 URL**")
    st.code(student_url, language=None)
st.info(
    "학생에게 위 URL, 평가 ID, 방 비밀번호를 함께 전달하세요. "
    "학생은 평가 ID와 방 비밀번호로 로그인 없이 입장합니다."
)

if st.button("상태 새로고침", width="stretch"):
    refresh_evaluation_state(
        evaluation_id,
        admin_password,
        get_evaluation_status=get_evaluation_status,
        get_context=get_context,
        list_questions=list_questions,
    )
    st.rerun()

last_operation = st.session_state.get(KEY_LAST_OPERATION)
if last_operation:
    st.warning(str(last_operation))

if st.button("context 생성 및 질문 만들기", type="primary"):
    with st.spinner("자료를 요약하고 질문을 생성하는 중입니다..."):
        clear_question_generation_error()
        status_before = refresh_evaluation_state(
            evaluation_id,
            admin_password,
            get_evaluation_status=get_evaluation_status,
            get_context=get_context,
            list_questions=list_questions,
        )
        phase_before = (
            str(status_before.get("phase", "")) if isinstance(status_before, dict) else ""
        )

        if phase_before == "questions_ready":
            st.session_state["question_generation_event"] = (
                "질문이 이미 DB에 저장되어 있어 기존 결과를 그대로 표시합니다."
            )
        elif not isinstance(status_before, dict):
            st.session_state["question_generation_event"] = (
                "현재 DB 상태를 확인하지 못했습니다. 상태 새로고침 후 다시 시도하세요."
            )
        else:
            if not bool(status_before.get("has_context")):
                context = call_api(extract_evaluation, evaluation_id, admin_password)
                if context:
                    st.session_state[KEY_CONTEXT] = context

            status_after_extract = refresh_evaluation_state(
                evaluation_id,
                admin_password,
                get_evaluation_status=get_evaluation_status,
                get_context=get_context,
                list_questions=list_questions,
            )
            phase_after = (
                str(status_after_extract.get("phase", ""))
                if isinstance(status_after_extract, dict)
                else ""
            )
            if phase_after == "questions_ready":
                st.session_state["question_generation_event"] = (
                    "질문이 이미 DB에 저장되어 있어 기존 결과를 그대로 표시합니다."
                )
            elif phase_after == "context_ready":
                questions, question_error = call_api_capture_error(
                    generate_questions, evaluation_id, admin_password
                )
                if question_error is not None:
                    status_after_error = refresh_evaluation_state(
                        evaluation_id,
                        admin_password,
                        get_evaluation_status=get_evaluation_status,
                        get_context=get_context,
                        list_questions=list_questions,
                    )
                    phase_after_error = (
                        str(status_after_error.get("phase", ""))
                        if isinstance(status_after_error, dict)
                        else ""
                    )
                    if phase_after_error == "questions_ready":
                        st.session_state["question_generation_error"] = None
                        st.session_state["question_generation_event"] = (
                            "질문 생성 응답은 지연됐지만 DB에는 질문이 저장되었습니다. DB 기준 결과를 표시합니다."
                        )
                    else:
                        persist_question_generation_error(evaluation_id, question_error)
                        st.session_state["question_generation_event"] = (
                            "질문 생성 API 요청이 실패했습니다. 아래 실패 단계와 확인 대상을 확인하세요."
                        )
                elif isinstance(questions, list) and not questions:
                    st.session_state["question_generation_event"] = (
                        "질문 생성 요청은 끝났지만 응답 질문 수가 0개입니다."
                    )
                    st.session_state[KEY_QUESTIONS] = []
                elif isinstance(questions, list):
                    st.session_state["question_generation_event"] = (
                        f"질문 생성 응답 {len(questions)}개를 받았습니다. DB 기준으로 다시 조회했습니다."
                    )
            elif isinstance(status_after_extract, dict):
                st.session_state["question_generation_event"] = str(
                    status_after_extract.get("user_message")
                    or "질문 생성 전 상태를 먼저 확인하세요."
                )
        refresh_evaluation_state(
            evaluation_id,
            admin_password,
            get_evaluation_status=get_evaluation_status,
            get_context=get_context,
            list_questions=list_questions,
        )
        st.rerun()

generation_event = st.session_state.get("question_generation_event")
if generation_event:
    st.caption(str(generation_event))
render_persisted_generation_error(evaluation_id)

context = st.session_state.get(KEY_CONTEXT)
if isinstance(context, dict):
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

questions = st.session_state.get(KEY_QUESTIONS, [])
status = st.session_state.get(KEY_EVALUATION_STATUS)
render_question_console(
    questions if isinstance(questions, list) else [],
    status if isinstance(status, dict) else None,
)

st.divider()
if st.button("최신 리포트 확인"):
    with st.spinner("리포트를 불러오는 중..."):
        report = call_api(get_latest_report, evaluation_id, admin_password)
        if report:
            st.session_state[KEY_REPORT] = report
            st.rerun()

report = st.session_state.get(KEY_REPORT)
if isinstance(report, dict):
    session_id = str(report.get("session_id", ""))
    session_token = ""
    joined = st.session_state.get(KEY_JOINED_SESSION)
    if isinstance(joined, dict):
        sess = joined.get("session", {})
        if isinstance(sess, dict) and str(sess.get("id", "")) == session_id:
            session_token = str(sess.get("session_token", ""))

    questions_data, q_err = call_api_capture_error(
        list_questions, evaluation_id, admin_password
    )
    questions_list = questions_data if isinstance(questions_data, list) else None

    turns_list = None
    t_err_msg = ""
    if session_id and session_token:
        turns_data, t_err = call_api_capture_error(
            list_turns, evaluation_id, session_id, session_token
        )
        turns_list = turns_data if isinstance(turns_data, list) else None
        if t_err is not None:
            t_err_msg = str(t_err)
    elif session_id and not session_token:
        t_err_msg = (
            "이 화면에서는 학생 세션 토큰을 보유하고 있지 않아 "
            "답변 전문/꼬리질문 상세를 불러올 수 없습니다."
        )

    render_report(
        report,
        questions=questions_list,
        turns=turns_list,
        questions_error=str(q_err) if q_err is not None else "",
        turns_error=t_err_msg,
    )
