"""방 목록 페이지: 모든 평가를 카드 그리드로 노출.

권한 없음(시연용 전체 공개). 카드 클릭 시 방 관리 페이지로 전환한다.
"""

from __future__ import annotations

import streamlit as st

from apps.streamlit.api_client import list_evaluations
from apps.streamlit.components.evaluation_card import render_evaluation_card
from apps.streamlit.state import init_state
from apps.streamlit.ui_helpers import call_api


init_state()

st.header("방 목록")
st.caption("등록된 모든 평가/방을 카드로 확인합니다. 관리하려는 방을 선택하세요.")

action_cols = st.columns([1, 1, 4])
with action_cols[0]:
    if st.button("← 홈으로"):
        st.switch_page("Home.py")
with action_cols[1]:
    if st.button("새 방 만들기"):
        st.switch_page("pages/10_wizard_1_info.py")

summaries = call_api(list_evaluations)

if summaries is None:
    st.stop()

if not summaries:
    st.info("등록된 방이 없습니다. '새 방 만들기'에서 첫 방을 만들어 보세요.")
else:
    st.caption(f"총 {len(summaries)}개 방")
    columns_per_row = 3
    for row_start in range(0, len(summaries), columns_per_row):
        cols = st.columns(columns_per_row)
        for col, summary in zip(cols, summaries[row_start : row_start + columns_per_row], strict=False):
            with col:
                render_evaluation_card(summary)
