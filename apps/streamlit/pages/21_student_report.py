"""학생용 리포트 페이지.

FastAPI redirect로 evaluation_id, session_id, session_token 쿼리 파라미터를
전달받는다. complete_session(idempotent) 후 render_report 컴포넌트로 그대로 렌더한다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import complete_session, list_questions, list_turns
from apps.streamlit.components.report import render_report
from apps.streamlit.state import init_state
from apps.streamlit.ui_helpers import (
    call_api_capture_error,
    query_param_value,
    render_api_error,
)


init_state()

st.header("인터뷰 리포트")

evaluation_id = query_param_value("evaluation_id")
session_id = query_param_value("session_id")
session_token = query_param_value("session_token")

if not (evaluation_id and session_id and session_token):
    st.error(
        "리포트 화면 진입에 필요한 정보가 부족합니다. 인터뷰 페이지에서 다시 진입해 주세요."
    )
    st.stop()

report, report_err = call_api_capture_error(
    complete_session, evaluation_id, session_id, session_token
)
if report_err is not None or not isinstance(report, dict):
    st.error("리포트를 불러오지 못했습니다.")
    if report_err is not None:
        render_api_error(report_err)
    st.stop()

questions_data, q_err = call_api_capture_error(
    list_questions, evaluation_id, "", session_id, session_token
)
questions_list = questions_data if isinstance(questions_data, list) else None

turns_data, t_err = call_api_capture_error(
    list_turns, evaluation_id, session_id, session_token
)
turns_list = turns_data if isinstance(turns_data, list) else None

render_report(
    report,
    questions=questions_list,
    turns=turns_list,
    questions_error=str(q_err) if q_err is not None else "",
    turns_error=str(t_err) if t_err is not None else "",
)
