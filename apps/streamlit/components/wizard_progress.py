"""마법사 5단계 진행 인디케이터."""

from __future__ import annotations

import streamlit as st


WIZARD_STEPS = [
    (1, "평가 정보"),
    (2, "자료 업로드"),
    (3, "질문 정책"),
    (4, "질문 검토"),
    (5, "학생 URL"),
]


def render_wizard_progress(current_step: int) -> None:
    """상단에 (1) → (2) → (3) → (4) → (5) 단계 표시."""
    parts = []
    for step, label in WIZARD_STEPS:
        if step < current_step:
            parts.append(f"✅ **{step}. {label}**")
        elif step == current_step:
            parts.append(f"🔵 **{step}. {label}**")
        else:
            parts.append(f"⚪ {step}. {label}")
    st.markdown(" → ".join(parts))
    st.divider()
