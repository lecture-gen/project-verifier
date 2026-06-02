# Dialearn — 프로젝트 수행 진위 검증 서비스

학생이 제출한 프로젝트 자료(zip 또는 GitHub URL)를 AI가 분석하고, 자료 근거 기반 인터뷰로 수행 진위를 검증하여 영역별 상세 리포트를 생성한다.

> 핵심 질문: **이 학생이 이 프로젝트를 진짜로 수행했는가?**

## 기술 스택

- **백엔드**: FastAPI · Pydantic v2 · SQLAlchemy 2.x · SQLite3 · OpenAI API (gpt-4o-mini)
- **프론트엔드**: Next.js 16 · React 19 · TypeScript · TanStack Query · shadcn/ui · Tailwind CSS v4
- **벡터 검색**: Qdrant (text-embedding-3-small)
- **음성**: OpenAI TTS/STT (gpt-4o-mini-tts, gpt-4o-transcribe)
- **인프라**: Docker Compose (api + web + qdrant) · uv · pnpm

## 작업 원칙

1. 실패를 silent fallback으로 숨기지 않는다 — 근본 원인과 실패 상태를 API/UI에서 추적 가능하게 드러낸다
2. 프로젝트 수행 진위 검증에 직접 필요하지 않은 기능은 추가하지 않는다
3. 캡스톤 시연용 프로젝트이므로 기능 구현을 우선하고 비필수 보안 요구는 완화할 수 있다

## 문서

코드 작성 전 아래 순서로 확인한다.

1. `docs/project-scope.md` — MVP 범위, 입출력, 처리 흐름, 제외 범위
2. `docs/architecture.md` — 기술 스택, 디렉터리 구조, 책임 분리, 설계 결정
3. `docs/domain-model.md` — 용어 정의, 핵심 엔티티, 상태 전이
4. `docs/api-flow.md` — API 라우트, 상태 머신, 인터뷰 흐름, 실패 처리
5. `docs/rag-pipeline.md` — artifact 분류, chunking, retrieval, context pack
6. `docs/security.md` — zip 안전장치, 파일 제한, 세션 인증, CORS
7. `docs/conventions.md` — Python/TypeScript 코딩 패턴, 프로젝트 규칙

## 실행

```bash
make backend-dev      # FastAPI (localhost:8000)
make frontend-dev     # Next.js (localhost:3000)
make qdrant-up        # Qdrant 벡터 DB (localhost:6333)
make frontend-types   # OpenAPI 기반 타입 재생성
```
