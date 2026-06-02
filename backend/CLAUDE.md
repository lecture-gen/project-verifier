# Backend — FastAPI

Python 3.13+ · FastAPI · Pydantic v2 · SQLAlchemy 2.x · SQLite3 · OpenAI API · Qdrant

## 실행

```bash
make backend-dev       # uv run uvicorn app.main:app --reload (localhost:8000)
make backend-lint      # ruff check
make backend-format    # ruff format
```

## 모듈 구조

`app/project_evaluations/` 하위:

| 모듈 | 역할 |
|------|------|
| `service.py` | 핵심 오케스트레이션 — 모든 비즈니스 흐름의 진입점 |
| `router.py` | REST API 엔드포인트 (~25개) |
| `router_realtime.py` | 임베디드 HTML 기반 단계형 인터뷰 UI (fallback) |
| `domain/` | Pydantic 모델, 토픽별 파일 분리 (enums, evaluation, session, interview, artifact, quality, report, bloom, common) |
| `persistence/` | SQLAlchemy ORM 모델 + Repository 패턴 |
| `ingestion/` | zip/GitHub 추출, 파일 분류, PDF/PPTX/DOCX 텍스트 추출 |
| `analysis/` | LLM 기반 프로젝트 컨텍스트 구축, 구조 분석, 품질 평가 |
| `rag/` | Qdrant 임베딩, chunking, retrieval, context pack 조립 |
| `interview/` | 질문 생성, 답변 평가, 꼬리질문, 세션 관리, STT/TTS |
| `reports/` | 최종 리포트 생성 |
| `prompts/` | LLM 프롬프트 템플릿 |

## 핵심 파일

- `service.py` (1,400줄) — 상태 전이, 파이프라인 오케스트레이션의 중심
- `domain/enums.py` — 모든 상태값, Bloom 단계, ArtifactRole 정의
- `persistence/models.py` — DB 스키마 원본 (10개 테이블)

상세 내용은 `docs/` 참조 (architecture, domain-model, api-flow, rag-pipeline).
