"""마법사 3단계: 질문 생성 정책 설정 + PATCH /question-policy.

총 문항 수와 Bloom 단계별 비율을 입력하고 백엔드 정책을 갱신한다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import update_question_policy
from apps.streamlit.components.page_guard import (
    mark_wizard_step_completed,
    require_evaluation,
)
from apps.streamlit.components.wizard_progress import render_wizard_progress
from apps.streamlit.state import (
    KEY_ADMIN_PASSWORD,
    KEY_EVALUATION,
    KEY_EVALUATION_ID,
    KEY_WIZARD_DRAFT_POLICY,
    init_state,
)
from apps.streamlit.ui_helpers import (
    BLOOM_LEVELS,
    calculate_bloom_distribution,
    call_api,
)


init_state()
require_evaluation(min_step=2, fallback_page="pages/11_wizard_2_upload.py")
render_wizard_progress(current_step=3)

evaluation_id = str(st.session_state[KEY_EVALUATION_ID])
admin_password = str(st.session_state[KEY_ADMIN_PASSWORD])

st.header("3단계 · 질문 생성 정책")
st.caption("총 문항 수와 Bloom 단계별 비율을 설정합니다. 동률은 Bloom 순서를 따릅니다.")

if st.button("← 이전 (자료 업로드)"):
    st.switch_page("pages/11_wizard_2_upload.py")

evaluation = st.session_state.get(KEY_EVALUATION) or {}
existing_policy = (
    evaluation.get("question_policy")
    if isinstance(evaluation, dict)
    else None
) or {}
existing_ratios = (
    existing_policy.get("bloom_ratios")
    if isinstance(existing_policy, dict)
    else None
) or {}
existing_total = int(existing_policy.get("total_question_count", 6) or 6)

draft = st.session_state.get(KEY_WIZARD_DRAFT_POLICY) or {}
draft_ratios = draft.get("bloom_ratios", {}) if isinstance(draft, dict) else {}
draft_total = int(draft.get("total_question_count", existing_total) or existing_total)

total_questions = st.slider(
    "총 문항 수",
    min_value=1,
    max_value=20,
    value=int(draft_total or existing_total or 6),
    step=1,
    key="policy_total_questions",
)
st.markdown("#### Bloom 단계별 비율")
ratio_cols = st.columns(3)
bloom_ratios: dict[str, int] = {}
for index, level in enumerate(BLOOM_LEVELS):
    initial = int(draft_ratios.get(level, existing_ratios.get(level, 1)) or 0)
    bloom_ratios[level] = ratio_cols[index % 3].slider(
        f"{level} 비율",
        min_value=0,
        max_value=10,
        value=initial,
        step=1,
        key=f"policy_bloom_ratio_{level}",
    )

planned_counts = calculate_bloom_distribution(int(total_questions), bloom_ratios)
if sum(bloom_ratios.values()) == 0:
    st.warning("Bloom 비율이 모두 0입니다. 하나 이상의 단계 비율을 1 이상으로 설정하세요.")
else:
    st.caption("예정 문항 수는 floor 배분 후 남은 문항을 큰 소수점 순으로 배정합니다.")
    st.dataframe(
        [
            {
                "Bloom 단계": level,
                "비율": bloom_ratios[level],
                "예정 문항 수": planned_counts[level],
            }
            for level in BLOOM_LEVELS
        ],
        hide_index=True,
        width="stretch",
    )

st.session_state[KEY_WIZARD_DRAFT_POLICY] = {
    "total_question_count": int(total_questions),
    "bloom_ratios": bloom_ratios,
}

if st.button("다음 → 질문 생성", type="primary", disabled=sum(bloom_ratios.values()) == 0):
    policy_payload = {
        "total_question_count": int(total_questions),
        "bloom_ratios": bloom_ratios,
    }
    with st.spinner("질문 정책을 저장합니다..."):
        updated = call_api(
            update_question_policy,
            evaluation_id,
            policy_payload,
            admin_password,
        )
    if updated:
        st.session_state[KEY_EVALUATION] = updated
        mark_wizard_step_completed(3)
        st.switch_page("pages/13_wizard_4_questions.py")
