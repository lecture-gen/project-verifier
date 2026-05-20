from __future__ import annotations

import json
import logging
import re
from enum import StrEnum
from typing import Literal

from app.project_evaluations.analysis.llm_client import LlmClient

logger = logging.getLogger(__name__)


class StudentIntent(StrEnum):
    ANSWER = "answer"
    SKIP = "skip"
    END_EXAM = "end_exam"


IntentMode = Literal["answer", "follow_up"]


_ANSWER_MODE_GUIDE = (
    "- answer: 현재 질문에 답변하거나 추가 설명을 하는 경우. "
    "여기에는 '모른다', '잘 모르겠다', '기억이 안 난다', '생각 안 난다' 같은 "
    "지식 부족/회상 실패 답변도 포함됩니다. 이런 표현은 의미 있는 답변이므로 반드시 answer입니다.\n"
    "- skip: 현재 질문을 명시적으로 건너뛰자고 하거나 \"다음 문제로 넘어가자\" 같이 말한 경우\n"
    "- end_exam: 검증 전체를 끝내자고 하는 경우"
)


_FOLLOW_UP_MODE_GUIDE = (
    "- answer: 학생이 꼬리질문에 대해 보충 답변을 시도하는 경우. 부분적 답변이라도 의미 있는 정보가 담겨 있으면 answer 입니다.\n"
    "- skip: 학생이 이 꼬리질문에 더 답할 게 없다고 명시적으로 표현했거나 다음 문제로 넘어가고 싶다고 한 경우. "
    "예시 표현: '잘 모르겠어요', '기억이 안 나요', '생각이 안 나요', '더 할 말 없어요', '답을 못 하겠어요', "
    "'다음 문제로 넘어갈게요', '넘어가자', '스킵', '패스'. "
    "꼬리질문 모드에서는 이런 give-up 표현을 모두 skip 으로 분류합니다 (이번 문제의 꼬리질문 라운드를 종료한다는 신호).\n"
    "- end_exam: 검증 전체를 끝내자고 하는 경우"
)


_INTENT_KEYWORDS: tuple[tuple[str, StudentIntent], ...] = (
    ("end_exam", StudentIntent.END_EXAM),
    ("end-exam", StudentIntent.END_EXAM),
    ("endexam", StudentIntent.END_EXAM),
    ("skip", StudentIntent.SKIP),
    ("answer", StudentIntent.ANSWER),
)


# === R1 비용 절감: 명확한 명령형/give-up 표현은 LLM 호출 없이 룰로 분류한다. ===
# 모호하거나 확신이 없는 표현은 룰에 넣지 않는다. 룰이 None 을 반환하면 기존 LLM 폴백.

_RULE_END_EXAM_PATTERNS: tuple[str, ...] = (
    "검증 종료",
    "평가 종료",
    "시험 종료",
    "검증 끝",
    "평가 끝",
    "그만할게",
    "그만할래",
    "그만하겠",
    "그만 하겠",
    "그만둘게",
    "끝낼게",
    "끝낼래",
    "끝내겠",
    "끝낼까",
    "end exam",
    "end_exam",
)

# 본 질문 답변 모드에서 "다음 문제로" 류 표현은 명시적 SKIP 신호.
_RULE_SKIP_ANSWER_MODE: tuple[str, ...] = (
    "스킵",
    "패스",
    "넘어가",
    "다음 문제",
    "다음문제",
    "건너뛰",
    "skip",
    "pass",
)

# 꼬리질문 모드에서는 give-up 류 표현도 SKIP (꼬리 라운드 종료 신호).
_RULE_SKIP_FOLLOW_UP_EXTRA: tuple[str, ...] = (
    "모르겠",
    "기억이 안",
    "기억 안",
    "답을 못",
    "더 할 말 없",
    "할 말 없",
    "할말 없",
    "답을 못하겠",
    "답 못하겠",
)


def _rule_based_intent(text: str, mode: IntentMode) -> StudentIntent | None:
    """LLM 호출 전에 명확 키워드만 룰로 매칭한다. 모호하면 None 으로 LLM 폴백.

    Args:
        text: 학생 발화 원본 (trim 없이 들어옴).
        mode: "answer" | "follow_up".
    """

    normalized = (text or "").strip().lower()
    if not normalized:
        # 빈 발화는 LLM 에게 넘기지 않고 그대로 LLM 폴백 결정에 맡긴다.
        return None

    for pattern in _RULE_END_EXAM_PATTERNS:
        if pattern in normalized:
            return StudentIntent.END_EXAM
    for pattern in _RULE_SKIP_ANSWER_MODE:
        if pattern in normalized:
            return StudentIntent.SKIP
    if mode == "follow_up":
        for pattern in _RULE_SKIP_FOLLOW_UP_EXTRA:
            if pattern in normalized:
                return StudentIntent.SKIP
    return None


def _parse_intent(response: str) -> StudentIntent | None:
    normalized = response.strip().lower()
    if not normalized:
        return None
    try:
        return StudentIntent(normalized)
    except ValueError:
        pass
    try:
        payload = json.loads(normalized)
        if isinstance(payload, dict):
            value = payload.get("intent")
            if isinstance(value, str):
                try:
                    return StudentIntent(value.strip().lower())
                except ValueError:
                    pass
    except (ValueError, TypeError):
        pass
    match = re.search(r"\"intent\"\s*:\s*\"([a-z_\-]+)\"", normalized)
    if match:
        try:
            return StudentIntent(match.group(1).replace("-", "_"))
        except ValueError:
            pass
    for keyword, intent in _INTENT_KEYWORDS:
        if keyword in normalized:
            return intent
    return None


def classify_student_intent(
    text: str,
    llm: LlmClient,
    mode: IntentMode = "answer",
) -> StudentIntent:
    if not llm.enabled():
        raise RuntimeError("학생 답변 의도 판별에 사용할 LLM client가 비활성화되어 있습니다.")

    # R1 비용 절감: 명확 키워드(skip/end_exam/give-up)는 LLM 호출 없이 룰로 분류.
    # 모호한 표현만 LLM 폴백 — 정확도 손실 없이 평가당 LLM 호출 수를 크게 줄인다.
    rule_intent = _rule_based_intent(text, mode)
    if rule_intent is not None:
        return rule_intent

    if mode == "follow_up":
        mode_context = "지금은 본 질문의 꼬리질문 라운드 도중입니다. 학생은 꼬리질문에 대해 다음과 같이 말했습니다:"
        mode_guide = _FOLLOW_UP_MODE_GUIDE
    else:
        mode_context = "프로젝트 수행 진위 검증 검증 중 학생이 다음과 같이 말했습니다:"
        mode_guide = _ANSWER_MODE_GUIDE

    response = llm.chat(
        [
            {
                "role": "user",
                "content": (
                    f"{mode_context}\n"
                    f'"{text}"\n\n'
                    "학생 의도를 아래 셋 중 하나로만 분류하세요.\n"
                    f"{mode_guide}\n\n"
                    "출력 형식: 다음 JSON 한 줄만 출력하세요. 다른 텍스트 금지.\n"
                    '{"intent":"answer"} 또는 {"intent":"skip"} 또는 {"intent":"end_exam"}'
                ),
            }
        ],
        temperature=0.0,
        max_tokens=32,
        cache_key=f"intent:{mode}",
    )
    parsed = _parse_intent(response)
    if parsed is not None:
        return parsed
    logger.warning(
        "intent parse failed: mode=%s response=%r — falling back to ANSWER (answer text preserved)",
        mode,
        response,
    )
    return StudentIntent.ANSWER
