from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Iterable

from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

from app.project_evaluations.rag.chunk_models import RetrievedChunk

# R1 비용 절감: 평가 진행 중 같은 쿼리(예: 영역명·고정 정찰 쿼리)가 반복 호출되는
# 패턴을 process-local LRU 로 흡수해 OpenAI embeddings 호출을 회피한다.
# 영구 캐시가 아니라 프로세스 재시작 시 사라지는 의도된 단기 캐시.
_QUERY_EMBED_CACHE_MAX = 256
_query_embed_cache: "OrderedDict[tuple[str, str], list[float]]" = OrderedDict()
_query_embed_cache_lock = threading.Lock()


def _embed_query(
    query: str,
    openai_client: OpenAI,
    embedding_model: str,
) -> list[float]:
    """쿼리 임베딩 1회 호출 + (model, query) 키 기준 in-memory LRU 캐시."""

    key = (embedding_model, query)
    with _query_embed_cache_lock:
        cached = _query_embed_cache.get(key)
        if cached is not None:
            # 최근 사용 순서로 갱신
            _query_embed_cache.move_to_end(key)
            return cached
    resp = openai_client.embeddings.create(input=[query], model=embedding_model)
    vector = resp.data[0].embedding
    with _query_embed_cache_lock:
        _query_embed_cache[key] = vector
        _query_embed_cache.move_to_end(key)
        while len(_query_embed_cache) > _QUERY_EMBED_CACHE_MAX:
            _query_embed_cache.popitem(last=False)
    return vector


def retrieve_chunks(
    query: str,
    evaluation_id: str,
    openai_client: OpenAI,
    qdrant_client: QdrantClient,
    collection_name: str,
    embedding_model: str = "text-embedding-3-small",
    top_k: int = 5,
    artifact_roles: Iterable[str] | None = None,
    chunk_types: Iterable[str] | None = None,
    source_types: Iterable[str] | None = None,
) -> list[RetrievedChunk]:
    query_vector = _embed_query(query, openai_client, embedding_model)
    response = qdrant_client.query_points(
        collection_name=collection_name,
        query=query_vector,
        query_filter=_build_filter(
            evaluation_id=evaluation_id,
            artifact_roles=artifact_roles,
            chunk_types=chunk_types,
            source_types=source_types,
        ),
        limit=top_k,
        with_payload=True,
    )
    return [
        RetrievedChunk.from_payload(point.payload, score=getattr(point, "score", None))
        for point in response.points
        if point.payload and "text" in point.payload
    ]


def retrieve_texts(
    query: str,
    evaluation_id: str,
    openai_client: OpenAI,
    qdrant_client: QdrantClient,
    collection_name: str,
    embedding_model: str = "text-embedding-3-small",
    top_k: int = 5,
) -> list[str]:
    return [
        chunk.text
        for chunk in retrieve_chunks(
            query=query,
            evaluation_id=evaluation_id,
            openai_client=openai_client,
            qdrant_client=qdrant_client,
            collection_name=collection_name,
            embedding_model=embedding_model,
            top_k=top_k,
        )
    ]


def _build_filter(
    evaluation_id: str,
    artifact_roles: Iterable[str] | None,
    chunk_types: Iterable[str] | None,
    source_types: Iterable[str] | None,
) -> Filter:
    must = [FieldCondition(key="evaluation_id", match=MatchValue(value=evaluation_id))]
    must.extend(_match_any("artifact_role", artifact_roles))
    must.extend(_match_any("chunk_type", chunk_types))
    must.extend(_match_any("source_type", source_types))
    return Filter(must=must)


def _match_any(key: str, values: Iterable[str] | None) -> list[FieldCondition]:
    selected = [value for value in values or [] if value]
    if not selected:
        return []
    if len(selected) == 1:
        return [FieldCondition(key=key, match=MatchValue(value=selected[0]))]
    return [FieldCondition(key=key, match=MatchAny(any=selected))]
