from collections.abc import Mapping

from pydantic import BaseModel, Field, model_validator

from app.project_evaluations.domain.enums import (
    BLOOM_ORDER,
    DEFAULT_BLOOM_RATIOS,
    DEFAULT_TOTAL_QUESTION_COUNT,
    MAX_BLOOM_RATIO,
    BloomLevel,
)


def normalize_bloom_level(value: object) -> str:
    text = value.value if isinstance(value, BloomLevel) else str(value)
    if text == "창조":
        return BloomLevel.CREATE.value
    if text not in {level.value for level in BLOOM_ORDER}:
        raise ValueError(f"지원하지 않는 Bloom 단계입니다: {text}")
    return text


def _normalize_bloom_ratios(ratios: Mapping[str, int] | None) -> dict[str, int]:
    source = ratios or DEFAULT_BLOOM_RATIOS
    if not isinstance(source, Mapping):
        raise ValueError("Bloom 비율은 단계별 숫자 mapping이어야 합니다.")
    normalized = {level.value: 0 for level in BLOOM_ORDER}
    for key, value in source.items():
        level = normalize_bloom_level(key)
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError("Bloom 비율은 0부터 10까지의 정수여야 합니다.")
        if value < 0 or value > MAX_BLOOM_RATIO:
            raise ValueError("Bloom 비율은 0부터 10까지의 정수여야 합니다.")
        normalized[level] = value
    return normalized


def distribute_bloom_questions(
    total_question_count: int,
    bloom_ratios: dict[str, int],
) -> dict[str, int]:
    ratios = _normalize_bloom_ratios(bloom_ratios)
    ratio_sum = sum(ratios.values())
    if ratio_sum == 0:
        raise ValueError("Bloom 비율은 하나 이상 1 이상이어야 합니다.")
    raw_counts = {
        level.value: total_question_count * ratios[level.value] / ratio_sum
        for level in BLOOM_ORDER
    }
    distribution = {level: int(raw_counts[level]) for level in raw_counts}
    remaining = total_question_count - sum(distribution.values())
    remainder_order = sorted(
        raw_counts,
        key=lambda level: (
            -(raw_counts[level] - distribution[level]),
            [item.value for item in BLOOM_ORDER].index(level),
        ),
    )
    for level in remainder_order[:remaining]:
        distribution[level] += 1
    return distribution


class QuestionGenerationPolicy(BaseModel):
    total_question_count: int = Field(
        default=DEFAULT_TOTAL_QUESTION_COUNT,
        ge=1,
        le=20,
    )
    bloom_ratios: dict[str, int] = Field(default_factory=lambda: dict(DEFAULT_BLOOM_RATIOS))
    bloom_distribution: dict[str, int] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_policy(cls, data: object) -> object:
        if data is None:
            data = {}
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        if "total_questions" in normalized and "total_question_count" not in normalized:
            normalized["total_question_count"] = normalized["total_questions"]
        ratios = _normalize_bloom_ratios(normalized.get("bloom_ratios"))
        normalized["bloom_ratios"] = ratios
        if sum(ratios.values()) == 0:
            raise ValueError("Bloom 비율은 하나 이상 1 이상이어야 합니다.")
        normalized["bloom_distribution"] = distribute_bloom_questions(
            int(normalized.get("total_question_count", DEFAULT_TOTAL_QUESTION_COUNT)),
            ratios,
        )
        return normalized
