"""Streamlit session_state 키 상수와 초기화 헬퍼.

여러 페이지가 동일한 키를 일관되게 사용하도록 한곳에 모은다.
"""

from __future__ import annotations

from typing import Any

import streamlit as st


KEY_EVALUATION_ID = "evaluation_id"
KEY_EVALUATION = "evaluation"
KEY_ADMIN_PASSWORD = "admin_password"
KEY_ADMIN_VERIFIED = "admin_verified"
KEY_ROOM_PASSWORD = "room_password"

KEY_UPLOAD_RESULT = "upload_result"
KEY_CONTEXT = "context"
KEY_EVALUATION_STATUS = "evaluation_status"
KEY_QUESTIONS = "questions"
KEY_QUESTION_GEN_EVENT = "question_generation_event"
KEY_QUESTION_GEN_ERROR = "question_generation_error"
KEY_LAST_OPERATION = "last_operation"

KEY_JOINED_SESSION = "joined_session"
KEY_REPORT = "report"

KEY_WIZARD_INFO = "wizard_info"
KEY_WIZARD_DRAFT_POLICY = "wizard_draft_policy"
KEY_WIZARD_COMPLETED_STEP = "wizard_completed_step"


_DEFAULTS: dict[str, Any] = {
    KEY_EVALUATION_ID: "",
    KEY_EVALUATION: None,
    KEY_ADMIN_PASSWORD: "",
    KEY_ADMIN_VERIFIED: False,
    KEY_ROOM_PASSWORD: "",
    KEY_UPLOAD_RESULT: None,
    KEY_CONTEXT: None,
    KEY_EVALUATION_STATUS: None,
    KEY_QUESTIONS: [],
    KEY_QUESTION_GEN_EVENT: None,
    KEY_QUESTION_GEN_ERROR: None,
    KEY_LAST_OPERATION: "",
    KEY_JOINED_SESSION: None,
    KEY_REPORT: None,
    KEY_WIZARD_INFO: None,
    KEY_WIZARD_DRAFT_POLICY: None,
    KEY_WIZARD_COMPLETED_STEP: 0,
}


def init_state() -> None:
    for key, value in _DEFAULTS.items():
        st.session_state.setdefault(key, value)


def reset_workspace() -> None:
    for key in list(st.session_state.keys()):
        del st.session_state[key]
    st.rerun()


def reset_wizard() -> None:
    st.session_state[KEY_WIZARD_INFO] = None
    st.session_state[KEY_WIZARD_DRAFT_POLICY] = None
    st.session_state[KEY_WIZARD_COMPLETED_STEP] = 0
    st.session_state[KEY_EVALUATION_ID] = ""
    st.session_state[KEY_EVALUATION] = None
    st.session_state[KEY_ADMIN_PASSWORD] = ""
    st.session_state[KEY_ADMIN_VERIFIED] = False
    st.session_state[KEY_UPLOAD_RESULT] = None
    st.session_state[KEY_CONTEXT] = None
    st.session_state[KEY_EVALUATION_STATUS] = None
    st.session_state[KEY_QUESTIONS] = []
    st.session_state[KEY_QUESTION_GEN_EVENT] = None
    st.session_state[KEY_QUESTION_GEN_ERROR] = None
    st.session_state[KEY_LAST_OPERATION] = ""
