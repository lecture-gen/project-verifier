"""문제별 채점 기준표(scoring rubric) 유틸리티.

이 모듈은 글로벌 디폴트 루브릭을 더 이상 제공하지 않는다. 각 문제는
자체 channel을 가지며, 채점 기준은 question_generator 단계에서 LLM이
문제별로 생성한다. 이 파일은 향후 per-question rubric 집계 헬퍼를
필요로 할 때 확장한다.
"""

from app.project_evaluations.domain.common import RubricScoreItem


def rubric_total_score(items: list[RubricScoreItem]) -> int:
    """채점 결과 항목들의 점수 합."""

    return sum(item.score for item in items)


def rubric_total_max_points(items: list[RubricScoreItem]) -> int:
    """채점 결과 항목들의 만점 합 (= 문제 max_points)."""

    return sum(item.max_points for item in items)
