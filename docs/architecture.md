# Dialearn 아키텍처 문서

**작성일**: 2026-05-27

## 개요

Dialearn은 AI 기반 프로젝트 진정성 검증 플랫폼이다. 학생이 업로드한 zip 파일(소스 코드, 문서, 보고서)을 분석하여 프로젝트 수행 여부를 검증하는 웹 서비스다.

```
Browser ↔ Next.js 16 (SSR/CSR) ↔ FastAPI ↔ SQLite3 / Qdrant / OpenAI API
```

---

## 1. 전체 시스템 아키텍처

### 1.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (사용자)                          │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│          Next.js 16 Frontend (SSR + CSR)                    │
│  - Route Handlers (API 호출)                                │
│  - React Components (UI 렌더링)                             │
│  - Web Audio API (음성 녹음)                                │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (포트 8000)                    │
│  - REST API (생성, 참여, 인터뷰, 리포트)                     │
│  - LLM 질문 생성 / 평가                                     │
│  - 파일 처리 및 RAG 색인 생성                               │
│  - 세션 상태 관리                                            │
└─────────────────────────────────────────────────────────────┘
                    ↙        ↓         ↘
        ┌───────────────┬─────────────┬──────────────┐
        ↓               ↓             ↓              ↓
    SQLite3        Qdrant        OpenAI         파일 시스템
    (app.db)       (벡터 저장소)   (LLM)         (artifacts)
```

### 1.2 통신 패턴

**브라우저 → API**
- `NEXT_PUBLIC_API_BASE_URL` 환경변수 사용 (공개, 브라우저에 인라인됨)
- 단일 도메인 Docker 배포에서는 비워 두고 same-origin `/api/project-evaluations` 프록시 사용

**SSR/Route Handlers → API**
- `INTERNAL_API_BASE_URL` 환경변수 사용 (Docker 내부, api:8000)
- 예: `http://api:8000`

---

## 2. 디렉터리 구조

### 2.1 백엔드 (`backend/app/`)

```
backend/app/
├── main.py                           # FastAPI 앱 생성
├── settings.py                       # ApiSettings (환경설정)
├── database.py                       # SQLite 초기화, 세션 팩토리
├── core/
│   ├── security.py                  # PBKDF2 암호 해시, 세션 토큰
│   └── rate_limit.py                # 인증 시도 레이트 리미팅
│
├── project_evaluations/
│   ├── router.py                    # GET/POST 주요 API 엔드포인트
│   ├── router_realtime.py           # WebSocket (인터뷰 실시간)
│   ├── service.py                   # 비즈니스 로직 (생성, 참여, 평가)
│   │
│   ├── analysis/                    # 프로젝트 분석 파이프라인
│   │   ├── context_builder.py       # 추출된 artifact로부터 프로젝트 context 구성
│   │   ├── llm_client.py            # OpenAI SDK 래퍼
│   │   ├── prompts.py               # LLM 프롬프트 템플릿
│   │   ├── quality_assessor.py      # 프로젝트 품질 평가
│   │   └── ...
│   │
│   ├── domain/                      # 도메인 모델 & DTOs
│   │   ├── models.py                # 모든 Pydantic 모델 (Read, Create, Update)
│   │   ├── enums.py                 # EvaluationStatus, ArtifactStatus 등
│   │   ├── evaluation.py            # ProjectEvaluation 도메인 로직
│   │   ├── artifact.py              # ProjectArtifact 도메인 로직
│   │   ├── interview.py             # 인터뷰 세션, 질문, 답변 로직
│   │   ├── session.py               # 인터뷰 참여 세션
│   │   ├── bloom.py                 # Bloom's Taxonomy 분류
│   │   ├── quality.py               # 품질 평가 관련 모델
│   │   ├── report.py                # 최종 리포트 모델
│   │   ├── question.py              # 질문 생성 정책
│   │   ├── common.py                # 공용 상수/열거형
│   │   └── ...
│   │
│   ├── ingestion/                   # 파일 수취 & 전처리
│   │   ├── zip_handler.py           # ZIP 파일 추출, 안전 검증
│   │   ├── file_classifier.py       # artifact_role별 분류
│   │   ├── artifact_processor.py    # 파일 타입별 처리 (PDF, DOCX, PPTX, 코드 등)
│   │   └── ...
│   │
│   ├── interview/                   # 인터뷰 실행 로직
│   │   ├── turn_flow.py             # 상태 관리, 다음 질문/리포트 결정
│   │   ├── evaluator.py             # 학생 답변 평가 (루브릭 적용)
│   │   ├── question_generator.py    # 질문 생성 (RAG 또는 규칙 기반)
│   │   ├── intent_classifier.py     # 학생 의도 분류 (답변, 건너뛰기 등)
│   │   ├── speech_service.py        # 음성 인식/합성 (OpenAI Whisper, TTS)
│   │   └── ...
│   │
│   ├── persistence/                 # 데이터 계층
│   │   ├── models.py                # SQLAlchemy ORM 모델
│   │   ├── repository.py            # 데이터 접근 추상화
│   │   └── ...
│   │
│   ├── prompts/                     # LLM 프롬프트 저장소
│   │   ├── question_generation.py   # 질문 생성 프롬프트
│   │   ├── evaluation.py            # 평가 프롬프트
│   │   ├── analysis.py              # 맥락 분석 프롬프트
│   │   └── ...
│   │
│   ├── rag/                         # RAG 기반 질문 생성
│   │   ├── ingestion.py             # Artifact → Qdrant 색인
│   │   ├── retrieval.py             # 의미 검색 (유사 청크 조회)
│   │   ├── splitter.py              # 텍스트/코드 분할 전략
│   │   ├── metadata.py              # Qdrant payload 구조
│   │   ├── redaction.py             # 민감정보 마스킹
│   │   └── ...
│   │
│   ├── reports/                     # 최종 리포트 생성
│   │   ├── report_generator.py      # 종합 리포트 조립
│   │   ├── analysis_report.py       # 영역별 분석 섹션
│   │   └── ...
│   │
│   └── realtime/                    # 실시간 통신
│       ├── ws_handler.py            # WebSocket 핸들러
│       └── ...
```

### 2.2 프론트엔드 (`frontend/src/`)

```
frontend/src/
├── app/                             # Next.js App Router
│   ├── layout.tsx                   # 루트 레이아웃 (헤더, 테마 제공)
│   ├── page.tsx                     # 홈 페이지 (평가 목록 또는 시작 화면)
│   ├── api/                         # Route Handlers (내부 API)
│   │   ├── auth/[...].ts           # 인증 관련 핸들러
│   │   └── ...
│   │
│   ├── create/                      # [GET] 평가 생성 마법사
│   │   ├── page.tsx
│   │   └── layout.tsx
│   │
│   ├── admin/                       # [GET] 평가 관리 콘솔
│   │   ├── [evaluationId]/
│   │   │   ├── admin-console.tsx   # 평가 상태, 질문 정책 편집
│   │   │   └── page.tsx
│   │   └── page.tsx
│   │
│   └── interview/                   # [GET] 인터뷰 실시
│       ├── [evaluationId]/
│       │   ├── join/                # [POST] 평가에 참여 (세션 토큰 획득)
│       │   │   └── page.tsx
│       │   │
│       │   ├── session/[sessionId]/
│       │   │   ├── page.tsx         # 인터뷰 화면
│       │   │   └── layout.tsx
│       │   │
│       │   └── report/              # [GET] 인터뷰 리포트
│       │       ├── [sessionId]/
│       │       │   └── page.tsx
│       │       └── ...
│       │
│       └── ...
│
├── components/                      # React 컴포넌트
│   ├── ui/                          # 기본 UI 컴포넌트 (shadcn/ui)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   ├── wizard/                      # 평가 생성 마법사
│   │   ├── context/                 # 상태 관리 (Zustand)
│   │   │   └── AreasGrid.tsx
│   │   ├── steps/                   # 각 단계 컴포넌트
│   │   └── ...
│   │
│   ├── interview/                   # 인터뷰 UI
│   │   ├── question-display.tsx     # 질문 표시
│   │   ├── answer-recorder.tsx      # 음성 답변 녹음
│   │   ├── transcription.tsx        # 텍스트 기반 답변
│   │   └── ...
│   │
│   ├── audio/                       # 음성 관련 컴포넌트
│   │   ├── audio-recorder.tsx       # Web Audio API
│   │   ├── audio-player.tsx
│   │   └── ...
│   │
│   ├── report/                      # 리포트 표시
│   │   ├── report-view.tsx
│   │   ├── area-analysis.tsx
│   │   ├── question-detail.tsx
│   │   └── ...
│   │
│   ├── room/                        # 평가실 관련
│   │   └── ...
│   │
│   └── ...
│
├── hooks/                           # Custom React Hooks
│   ├── use-api.ts                   # API 호출 추상화
│   ├── use-session.ts               # 세션 상태 관리
│   ├── use-audio.ts                 # 음성 녹음/재생
│   └── ...
│
├── lib/                             # 유틸리티
│   ├── api/
│   │   ├── client.ts                # API 클라이언트 생성 (axios or fetch)
│   │   ├── types.gen.ts             # OpenAPI 자동 생성 타입
│   │   └── ...
│   │
│   ├── audio/                       # 음성 처리
│   │   ├── recorder.ts              # Web Audio API 래퍼
│   │   └── ...
│   │
│   ├── session/                     # 세션 관리
│   │   ├── token.ts                 # 세션 토큰 저장/로드
│   │   └── ...
│   │
│   ├── format/                      # 형식 변환
│   │   └── ...
│   │
│   ├── constants/                   # 상수
│   │   └── ...
│   │
│   ├── wizard/                      # 마법사 로직
│   │   └── ...
│   │
│   └── ...
```

---

## 3. 데이터 모델 (도메인)

### 3.1 핵심 엔티티

#### ProjectEvaluation (평가 인스턴스)
- `id` (UUID)
- `name` (평가 이름)
- `status` (대기 중, 분석 중, 진행 중, 완료)
- `room_password_hash` (방 진입 암호, PBKDF2)
- `question_policy_json` (질문 생성 정책)
- `created_at`, `updated_at`

#### ProjectArtifact (업로드된 파일)
- `id` (UUID)
- `evaluation_id` (FK)
- `artifact_role` (code, readme, report, api_spec, design_doc, presentation, source_text)
- `file_name`
- `status` (수취됨, 처리 중, 처리됨, 실패)
- `created_at`

#### ExtractedProjectContext (분석된 맥락)
- `id` (UUID)
- `evaluation_id` (FK)
- `rag_status_json` (RAG 색인 상태)
- `architecture_json` (시스템 아키텍처 분석)
- `student_risks_json` (신뢰도 위험 요소)
- `structural_facts_json` (구조적 사실, 의존성)

#### ProjectArea (프로젝트 영역)
- `id` (UUID)
- `evaluation_id` (FK)
- `name` (백엔드, 프론트엔드, 데이터베이스, 인프라 등)
- `role_in_project` (학생 역할 기술)
- `key_concerns_json` (검증 초점)

#### InterviewQuestion (생성된 질문)
- `id` (UUID)
- `evaluation_id` (FK)
- `area_id` (FK)
- `question_text`
- `bloom_level` (Remember, Understand, Apply, Analyze, Evaluate, Create)
- `generation_source` (rag, rule_based)
- `evidence_refs_json` (RAG 소스 참고)

#### InterviewSession (인터뷰 참여)
- `id` (UUID)
- `evaluation_id` (FK)
- `participant_name` (학생 이름)
- `session_token_hash` (세션 토큰, PBKDF2)
- `status` (진행 중, 완료)
- `current_question_index`
- `created_at`, `started_at`, `completed_at`

#### InterviewTurn (Q&A 쌍)
- `id` (UUID)
- `session_id` (FK)
- `question_id` (FK)
- `student_answer_text` (텍스트 또는 음성 인식)
- `student_answer_audio_path` (원본 음성 파일)
- `finalized_score` (루브릭 점수, 0~10)
- `follow_up_reason` (추가 질문 이유)
- `conversation_history_json` (LLM 호출 히스토리)

#### EvaluationReport (최종 리포트)
- `id` (UUID)
- `session_id` (FK)
- `overall_verdict` (통과, 추가 확인 필요, 신뢰 낮음)
- `area_scores_json` (영역별 신뢰도)
- `bloom_achievement_json` (Bloom 단계별 도달도)
- `strength_points_json` (강점)
- `suspicious_points_json` (의심 지점)
- `generated_at`

---

## 4. API 엔드포인트 (주요)

### 4.1 평가 생성 및 관리

```
POST   /api/project-evaluations
       → ProjectEvaluationCreate (name, room_password)
       ← ProjectEvaluationRead

GET    /api/project-evaluations
       ← list[ProjectEvaluationSummaryRead]

GET    /api/project-evaluations/{evaluation_id}
       ← ProjectEvaluationRead

PATCH  /api/project-evaluations/{evaluation_id}/question-policy
       → QuestionPolicyUpdate
       ← ProjectEvaluationRead

GET    /api/project-evaluations/{evaluation_id}/status
       ← ProjectEvaluationStatusRead
```

### 4.2 파일 업로드 (Artifact Ingestion)

```
POST   /api/project-evaluations/{evaluation_id}/artifacts/upload-zip
       Content-Type: multipart/form-data
       → File (zip)
       ← ArtifactUploadResult (artifacts[], rag_status)

POST   /api/project-evaluations/{evaluation_id}/artifacts/import-github
       → { github_url: string }
       ← ArtifactUploadResult

GET    /api/project-evaluations/{evaluation_id}/artifacts
       ← list[ProjectArtifactRead]

GET    /api/project-evaluations/{evaluation_id}/context
       ← ExtractedProjectContextRead
```

### 4.3 인터뷰 (참여 및 진행)

```
POST   /api/project-evaluations/{evaluation_id}/join
       → JoinEvaluationRequest (participant_name, room_password)
       ← JoinEvaluationRead (session_id, session_token)

GET    /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}
       Headers: X-Session-Token
       ← InterviewSessionRead

GET    /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/state
       Headers: X-Session-Token
       ← StudentInterviewStateRead

POST   /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/flow
       Headers: X-Session-Token
       → InterviewTurnFlowRequest (answer_text or audio_file, mode)
       ← InterviewTurnFlowResponse (status, next_mode, report)

POST   /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/turns
       Headers: X-Session-Token
       → InterviewTurnCreate (question_id, answer_text, audio_file)
       ← InterviewTurnRead
```

### 4.4 음성 처리

```
POST   /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/transcribe
       Content-Type: multipart/form-data
       → File (audio)
       ← InterviewTranscriptionRead (text)

POST   /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/speak
       → { text: string }
       ← { audio_url: string }
```

### 4.5 리포트

```
GET    /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/report
       Headers: X-Session-Token
       ← EvaluationReportRead

GET    /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/questions
       Headers: X-Session-Token
       ← list[InterviewQuestionRead]

GET    /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/turns
       Headers: X-Session-Token
       ← list[InterviewTurnRead]
```

### 4.6 실시간 (WebSocket)

```
WebSocket /ws/interview/{evaluation_id}/{session_id}
           X-Session-Token: <token>

Message types:
  - question_generated: { question: InterviewQuestionRead }
  - turn_evaluated: { turn: InterviewTurnRead }
  - report_ready: { report: EvaluationReportRead }
```

---

## 5. 책임 분리 (Separation of Concerns)

### 5.1 프론트엔드의 책임

✅ **수행**
- UI 렌더링 (React 컴포넌트)
- 라우팅 (Next.js App Router)
- 폼 유효성 검사 (React Hook Form + Zod)
- Web Audio API를 통한 음성 녹음
- 세션 토큰 저장/로드 (localStorage/cookies)
- API 호출 구성 (TanStack Query)
- 클라이언트 상태 관리 (Zustand)

❌ **미수행**
- LLM 호출
- 파일 처리
- 평가 로직
- 데이터베이스 접근

### 5.2 백엔드의 책임

✅ **수행**
- 모든 비즈니스 로직
- OpenAI API 호출 (질문 생성, 평가, 음성 처리)
- ZIP 파일 추출 및 안전 검증
- Artifact 분류 및 처리
- Qdrant 색인 생성 (RAG)
- SQLite 데이터베이스 관리
- 세션 토큰 검증 및 발급
- 파일 저장소 관리 (`data/artifacts/`)

### 5.3 API 클라이언트 패턴

**브라우저 코드 (Client Components)**
```typescript
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
// 예: https://dialearn.presso.ac
fetch(`${apiBaseUrl}/api/project-evaluations`);
```

**서버 컴포넌트 & Route Handlers**
```typescript
const apiBaseUrl = process.env.INTERNAL_API_BASE_URL;
// Docker 내부에서: http://api:8000
fetch(`${apiBaseUrl}/api/project-evaluations`);
```

---

## 6. 설계 결정 (Design Decisions)

### 6.1 Next.js 16 선택 (Streamlit 대신)

| 기준 | Streamlit | Next.js |
|------|-----------|---------|
| UI 풍부도 | 낮음 (기본 위젯만) | 높음 (React 생태계) |
| SSR 지원 | 없음 | 있음 (성능 최적화) |
| 음성 인터뷰 UX | 제한적 | Web Audio API 완전 지원 |
| 배포 난이도 | 낮음 | 중간 |

**결론**: 풍부한 UI, 음성 처리, 성능 최적화가 필수적이므로 Next.js 선택.

### 6.2 직접 OpenAI SDK (LangGraph/LangChain 대신)

| 기준 | LangGraph | LangChain | 직접 SDK |
|------|-----------|-----------|---------|
| 학습곡선 | 높음 | 높음 | 낮음 |
| 디버깅 용이도 | 보통 | 낮음 | 높음 |
| 유연성 | 중간 | 중간 | 높음 |
| 번들 크기 | 중간 | 큼 | 작음 |

**결론**: 단순성, 빠른 구현, 디버깅이 우선이므로 OpenAI SDK 직접 사용.

### 6.3 SQLite3 (PostgreSQL 대신)

| 기준 | PostgreSQL | SQLite3 |
|------|-----------|---------|
| 설정 복잡도 | 높음 | 없음 |
| 동시성 | 매우 좋음 | 제한적 |
| 확장성 | 좋음 | 제한적 |
| 캡스톤 시연용 | 과할 수 있음 | 충분함 |

**결론**: 캡스톤 시연 목적이므로 외부 의존성 최소화, SQLite3 선택.

### 6.4 Qdrant 벡터 저장소 (RAG)

- 의미 검색 기반 질문 생성
- OpenAI 임베딩 모델 (`text-embedding-3-small`)로 청크 벡터화
- `RAG_ENABLED=false` 시 규칙 기반 fallback

### 6.5 세션 토큰 인증 (OAuth/학교 로그인 대신)

- 간단한 참여 토큰 (`secrets.token_urlsafe(32)`)
- PBKDF2 해시로 저장
- 헤더 또는 쿠키로 전달

### 6.6 GitHub URL Import 지원

- zip 외에 공개 GitHub 저장소 직접 분석 (시연 편의)
- `gh` CLI 또는 GitHub API로 클론
- GitHub Actions 로그 등 자동 추출 불가

---

## 7. Docker Compose 구성

### 7.1 3개 서비스

```yaml
services:
  api:                      # FastAPI 백엔드
    image: dialearn-api:latest
    ports: [8000:8000]
    volumes: [dialearn_app_data:/app/data]
    depends_on: [qdrant]
    healthcheck: HTTP 8000/health

  web:                      # Next.js 프론트엔드
    image: dialearn-web:latest
    ports: [3000:3000]
    depends_on: [api]
    env: INTERNAL_API_BASE_URL=http://api:8000

  qdrant:                   # 벡터 저장소
    image: qdrant/qdrant:v1.15.4
    ports: [6333:6333]
    volumes: [dialearn_qdrant_storage:/qdrant/storage]
```

### 7.2 외부 볼륨 & 네트워크

**외부 볼륨** (사전 생성 필요)
```bash
docker volume create dialearn_app_data
docker volume create dialearn_qdrant_storage
```

**외부 네트워크** (프록시/리버스 프록시용)
```bash
docker network create proxy
```

### 7.3 환경변수 (`.env`)

```env
OPENAI_API_KEY=sk-...
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
OPENAI_QUESTION_MODEL=gpt-4o-mini
OPENAI_EVAL_MODEL=gpt-4o-mini
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts

APP_SQLITE_PATH=/app/data/app.db
APP_ARTIFACT_DIR=/app/data/artifacts
APP_MAX_UPLOAD_MB=50
APP_MAX_EXTRACTED_MB=150
APP_MAX_ZIP_MEMBERS=2000
APP_MAX_PROCESSED_FILES=1000

QDRANT_URL=http://qdrant:6333
RAG_ENABLED=true

PUBLIC_WEB_BASE_URL=https://dialearn.presso.ac
NEXT_PUBLIC_API_BASE_URL=
CORS_ALLOW_ORIGINS=https://dialearn.presso.ac,http://localhost:3000
```

---

## 8. 데이터 흐름

### 8.1 평가 생성 → 파일 업로드 → 질문 생성 → 인터뷰 → 리포트

```
1. 교강사: 평가 생성
   POST /api/project-evaluations
   → ProjectEvaluation (상태: waiting_for_artifacts)

2. 교강사: ZIP 업로드 또는 GitHub URL import
   POST /api/project-evaluations/{evaluation_id}/artifacts/upload-zip
   → [ProjectArtifact]
   → Artifact 분류 (code, readme, report 등)
   → 전처리 (PDF → 텍스트, DOCX → 단락 등)
   → Qdrant에 색인
   → ProjectEvaluation 상태: in_progress

3. 시스템: 프로젝트 맥락 분석
   → ExtractedProjectContext 생성
   → 아키텍처 추출
   → 신뢰도 위험 요소 식별

4. 시스템: 질문 생성
   → ProjectArea 생성 (백엔드, 프론트엔드 등)
   → InterviewQuestion 생성 (RAG 기반 또는 규칙 기반)
   → Bloom's Taxonomy 단계 할당

5. 학생: 평가 참여
   POST /api/project-evaluations/{evaluation_id}/join
   → InterviewSession 생성
   → 세션 토큰 발급
   → 상태: in_progress

6. 학생: 각 질문에 답변
   POST /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/flow
   → 음성/텍스트 답변 수취
   → Whisper로 음성 인식 (필요시)
   → LLM으로 평가 (루브릭 적용)
   → InterviewTurn 저장 (점수 포함)

7. 모든 질문 답변 완료 시
   → EvaluationReport 생성
   → 최종 판정 (통과 / 추가 확인 / 신뢰 낮음)
   → 영역별 분석, Bloom 단계별 도달도
   → 강점/의심 지점 요약

8. 교강사: 최종 리포트 검토
   GET /api/project-evaluations/{evaluation_id}/interview/sessions/{session_id}/report
   ← EvaluationReportRead
```

---

## 9. 주요 기술 스택

### 9.1 백엔드

| 계층 | 라이브러리 | 버전 |
|------|-----------|------|
| 프레임워크 | FastAPI | 최신 |
| 데이터베이스 | SQLAlchemy | 2.0+ |
| ORM | SQLAlchemy ORM | |
| 데이터 검증 | Pydantic | 2.0+ |
| 설정 관리 | pydantic-settings | |
| 벡터 저장소 | Qdrant 클라이언트 | |
| LLM | OpenAI SDK | |
| 파일 처리 | python-pptx, python-docx, pypdf | |
| 보안 | hashlib (PBKDF2), secrets | stdlib |

### 9.2 프론트엔드

| 계층 | 라이브러리 | 버전 |
|------|-----------|------|
| 프레임워크 | Next.js | 16.2.6 |
| UI 라이브러리 | React | 19.2.4 |
| 스타일링 | Tailwind CSS | 4 |
| 폼 | React Hook Form | 7.76.0 |
| 유효성 검사 | Zod | 4.4.3 |
| UI 컴포넌트 | shadcn/ui, Radix UI | |
| 데이터 페칭 | TanStack Query | 5.100.10 |
| 상태 관리 | Zustand | (필요시) |
| 시각화 | Nivo | 0.99.0 |
| 아이콘 | Lucide React | 1.16.0 |

### 9.3 설정 및 배포

| 항목 | 도구 |
|------|------|
| 컨테이너화 | Docker |
| 오케스트레이션 | Docker Compose |
| 패키지 관리 (Python) | pip, uv |
| 패키지 관리 (Node) | pnpm |
| 타입 생성 | openapi-typescript |
| 린팅 (Python) | ruff, mypy |
| 린팅 (TypeScript) | eslint |
| 포매팅 (Python) | black |

---

## 10. 보안 및 레이트 리미팅

### 10.1 인증

- **세션 토큰**: `secrets.token_urlsafe(32)` (32바이트 난수)
- **저장**: PBKDF2-SHA256 해시 (120,000 iterations)
- **전달**: `X-Session-Token` 헤더 또는 쿠키

### 10.2 암호 해시

- **알고리즘**: PBKDF2-SHA256
- **반복**: 120,000회
- **사용처**: 방 암호, 세션 토큰

### 10.3 레이트 리미팅

```python
# backend/app/core/rate_limit.py
record_auth_failure(client_id)     # 인증 실패 기록
check_auth_attempt(client_id)      # 시도 제한 확인 (과도 시 HTTPException)
clear_auth_failures(client_id)     # 성공 후 초기화
```

### 10.4 파일 안전

- ZIP 추출 전 멤버 수 확인 (`APP_MAX_ZIP_MEMBERS=2,000`)
- ZIP 폭탄 방지: 압축 해제 크기 제한 (`APP_MAX_EXTRACTED_MB=150`)
- 각 파일 크기 제한 (`APP_MAX_TEXT_FILE_MB=10`)
- 총 처리 파일 수 제한 (`APP_MAX_PROCESSED_FILES=1,000`)
- 최대 추출 텍스트 문자 제한 (`APP_MAX_EXTRACTED_TEXT_CHARS=500,000`)

### 10.5 민감 정보 마스킹

```python
# backend/app/project_evaluations/rag/redaction.py
redact_sensitive_text(text)  # API 키, 이메일, 전화번호 마스킹
```

---

## 11. 성능 고려사항

### 11.1 데이터베이스

- **연결 풀**: SQLAlchemy 기본 풀링
- **외래키**: SQLite PRAGMA foreign_keys=ON
- **인덱스**: `interview_turns` 테이블에 `(session_id, question_id)` 복합 인덱스

### 11.2 RAG 색인

- **청크 크기**: 일반 코드/문서별 설정
- **벡터화**: OpenAI 임베딩 모델 (`text-embedding-3-small`)
- **페이로드**: artifact_role, file_path, source_ref 포함

### 11.3 API 응답

- **스트리밍**: WebSocket 또는 Server-Sent Events (실시간 리포트 생성 중)
- **캐싱**: TanStack Query 클라이언트 캐싱

---

## 12. 로깅 및 모니터링

### 12.1 백엔드 로깅

```python
import logging
logger = logging.getLogger(__name__)
logger.info("이벤트 기록")
logger.error("오류 상황", exc_info=True)
```

### 12.2 헬스체크

```
GET /health
→ { "status": "ok", "service": "project-evaluation-api", "storage": {...} }
```

---

## 13. 확장성 및 향후 계획

### 13.1 현재 MVP

- ZIP 파일 및 GitHub URL 업로드
- 자동 질문 생성 (RAG 또는 규칙 기반)
- 인터뷰 실시 (음성 또는 텍스트)
- 자동 평가 (루브릭)
- 최종 리포트 생성

### 13.2 향후 추가 기능

- 여러 학생 비교 분석
- 리포트 PDF export
- 복잡한 권한 시스템
- 동영상 감독 (WebRTC)
- 심화 인터뷰 (추가 질문 자동 생성)
- 대시보드 (관리자용 통계)

---

## 참고

- 환경설정: `/Users/user/Desktop/dev/univ/grade_4/intelligent-system-capstone/v2/backend/app/settings.py`
- 데이터베이스 초기화: `/Users/user/Desktop/dev/univ/grade_4/intelligent-system-capstone/v2/backend/app/database.py`
- 라우터: `/Users/user/Desktop/dev/univ/grade_4/intelligent-system-capstone/v2/backend/app/project_evaluations/router.py`
- 프론트엔드 패키지: `/Users/user/Desktop/dev/univ/grade_4/intelligent-system-capstone/v2/frontend/package.json`
- Docker 구성: `/Users/user/Desktop/dev/univ/grade_4/intelligent-system-capstone/v2/docker-compose.yml`
