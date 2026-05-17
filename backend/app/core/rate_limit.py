"""인증 실패 횟수 기반의 단순 in-process rate limiter."""

from __future__ import annotations

import time

from fastapi import HTTPException, status

AUTH_WINDOW_SECONDS = 60
AUTH_MAX_FAILURES = 8

_AUTH_FAILURES: dict[tuple[str, str, str], list[float]] = {}


def _key(scope: str, evaluation_id: str, identity: str) -> tuple[str, str, str]:
    return (scope, evaluation_id, identity or "anonymous")


def check_auth_attempt(scope: str, evaluation_id: str, identity: str) -> None:
    now = time.monotonic()
    key = _key(scope, evaluation_id, identity)
    attempts = [t for t in _AUTH_FAILURES.get(key, []) if now - t < AUTH_WINDOW_SECONDS]
    _AUTH_FAILURES[key] = attempts
    if len(attempts) >= AUTH_MAX_FAILURES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요.",
        )


def record_auth_failure(scope: str, evaluation_id: str, identity: str) -> None:
    _AUTH_FAILURES.setdefault(_key(scope, evaluation_id, identity), []).append(time.monotonic())


def clear_auth_failures(scope: str, evaluation_id: str, identity: str) -> None:
    _AUTH_FAILURES.pop(_key(scope, evaluation_id, identity), None)
