# API 흐름 및 엔드포인트 명세

**마지막 업데이트:** 2026-05-27  
**서비스:** Dialearn 프로젝트 인증 검증 시스템  
**기술 스택:** FastAPI (Python), Next.js 16 (TypeScript)  

---

## 개요

Dialearn은 학생 제출 프로젝트의 진정성(authenticity)을 단계형 인터뷰와 RAG 기반 질문 생성으로 검증하는 시스템이다. 

프로젝트 자료(zip)를 업로드하면:
1. 자료를 문서/코드/설정 등 역할별로 분류하고 추출
2. 코드베이스 구조와 문서 내용을 분석해 컨텍스트 생성
3. Bloom의 분류학과 루브릭 기반 질문 자동 생성
4. 학생과 대화형 인터뷰 진행 (음성/텍스트 모두 지원)
5. 최종 검증 리포트 생성

---

## 엔드포인트 전체 목록

기본 경로: `/api/project-evaluations`

### 평가 CRUD (관리자)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/` | 평가 생성 | `ProjectEvaluationCreate` | `ProjectEvaluationRead` |
| **GET** | `/` | 평가 목록 조회 | - | `list[ProjectEvaluationSummaryRead]` |
| **GET** | `/{evaluation_id}` | 평가 상세 조회 | - | `ProjectEvaluationRead` |
| **GET** | `/{evaluation_id}/status` | 평가 상태 및 진행도 | - | `ProjectEvaluationStatusRead` |
| **PATCH** | `/{evaluation_id}/question-policy` | Bloom 비율 조정 | `QuestionPolicyUpdate` | `ProjectEvaluationRead` |

### 자료 업로드 (관리자)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/{evaluation_id}/artifacts/zip` | ZIP 파일 업로드 | `file: UploadFile` | `ArtifactUploadResult` |
| **POST** | `/{evaluation_id}/artifacts/github` | GitHub 저장소 임포트 | `github_url: str` | `ArtifactUploadResult` |
| **GET** | `/{evaluation_id}/artifacts` | 업로드된 자료 목록 | - | `list[ProjectArtifactRead]` |

### 컨텍스트 추출 및 분석 (관리자)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/{evaluation_id}/extract` | 컨텍스트 추출 (비동기 작업) | - | `ExtractedProjectContextRead` |
| **GET** | `/{evaluation_id}/context` | 추출된 컨텍스트 조회 | - | `ExtractedProjectContextRead` |
| **POST** | `/{evaluation_id}/quality-assessment` | 품질 사전 평가 | - | `ProjectQualityAssessmentRead` |
| **GET** | `/{evaluation_id}/quality-assessment` | 품질 평가 결과 조회 | - | `ProjectQualityAssessmentRead` |

### 질문 관리 (관리자/학생)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/{evaluation_id}/questions/generate` | 질문 자동 생성 | - | `list[InterviewQuestionRead]` |
| **GET** | `/{evaluation_id}/questions` | 질문 목록 조회 | - | `list[InterviewQuestionRead]` |

### 세션 관리 (학생 진입)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/{evaluation_id}/join` | 평가 참여 (세션 생성) | `participant_name: str` | `JoinEvaluationRead` |
| **POST** | `/{evaluation_id}/sessions` | 인터뷰 세션 생성 | - | `InterviewSessionRead` |
| **GET** | `/{evaluation_id}/sessions` | 세션 목록 조회 | - | `list[InterviewSessionRead]` |

### 인터뷰 상태 및 흐름 (학생)

| 메서드 | 경로 | 설명 | 요청 | 응답 | 인증 |
|--------|------|------|------|------|------|
| **GET** | `/{evaluation_id}/sessions/{session_id}/interview/state` | 현재 인터뷰 상태 | - | `StudentInterviewStateRead` | session_token |
| **POST** | `/{evaluation_id}/sessions/{session_id}/interview/transcribe` | 오디오 STT | `audio: UploadFile, mode: enum` | `InterviewTranscriptionRead` | session_token |
| **POST** | `/{evaluation_id}/sessions/{session_id}/interview/answer` | 답변 제출 및 평가 | `InterviewTurnFlowRequest` | `InterviewTurnFlowResponse` | session_token |
| **POST** | `/{evaluation_id}/sessions/{session_id}/interview/tts` | 질문 음성 합성 | `text, voice, instructions` | `audio/mpeg (stream)` | session_token |
| **POST** | `/{evaluation_id}/sessions/{session_id}/interview/complete` | 인터뷰 완료 | - | `EvaluationReportRead` | session_token |
| **POST** | `/{evaluation_id}/sessions/{session_id}/interview/abort` | 인터뷰 중단 | - | `EvaluationReportRead` | session_token |

### 턴(대화) 관리 (학생/관리자)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **POST** | `/{evaluation_id}/sessions/{session_id}/turns` | 턴 제출 (레거시 API) | `InterviewTurnCreate` | `InterviewTurnRead` |
| **GET** | `/{evaluation_id}/sessions/{session_id}/turns` | 턴 목록 조회 | - | `list[InterviewTurnRead]` |

### 리포트 (학생/관리자)

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|--------|------|------|------|------|
| **GET** | `/{evaluation_id}/reports` | 리포트 목록 | - | `list[EvaluationReportRead]` |
| **GET** | `/{evaluation_id}/reports/latest` | 최신 리포트 | - | `EvaluationReportRead` |
| **GET** | `/{evaluation_id}/reports/{report_id}` | 특정 리포트 조회 | - | `EvaluationReportRead` |

---

## 상태 머신 (상태 전이)

```
created
  ↓ (zip/github 업로드)
uploaded
  ↓ (컨텍스트 추출)
analyzed
  ↓ (품질 평가, Bloom 정책 조정)
analyzed (준비 완료)
  ↓ (질문 생성)
questions_generated
  ↓ (학생 참여 & 세션 생성)
interviewing
  ↓ (모든 질문 답변 & 인터뷰 완료)
reported
```

### 상태별 가능한 액션

| 상태 | 가능한 액션 | 이동할 상태 |
|------|-----------|-----------|
| `created` | 자료 업로드 | → `uploaded` |
| `uploaded` | 컨텍스트 추출 | → `analyzed` |
| `analyzed` | 품질 평가, 정책 변경, 질문 생성 | → `questions_generated` |
| `questions_generated` | 학생 참여, 세션 생성 | → `interviewing` |
| `interviewing` | 인터뷰 진행, 완료 | → `reported` |
| `reported` | (최종 상태) | - |

---

## 핵심 흐름

### 1. 관리자(교수자) 흐름

```
1. POST /api/project-evaluations
   ├─ name: string
   ├─ question_policy: { Bloom 레벨별 비율 }
   ├─ project_category: "weekly" | "midterm" | "final" | "capstone_final"
   └─ focus_points: string (평가 포인트)
   
   ↓ 응답: ProjectEvaluationRead (status: "created")

2. POST /{id}/artifacts/zip (또는 /artifacts/github)
   ├─ file: UploadFile (zip)
   └─ 자료 분류: code, docs, config, test, presentation, report 등
   
   ↓ 응답: ArtifactUploadResult
   ├─ accepted_count
   ├─ artifacts: list[ProjectArtifactRead]
   └─ 상태 → "uploaded"

3. POST /{id}/extract
   ├─ 자료 테마 추출 및 분석 (비동기 작업)
   ├─ RAG 벡터 임베딩 (Qdrant)
   └─ 컨텍스트 생성
   
   ↓ 응답: ExtractedProjectContextRead
   ├─ summary: 프로젝트 요약
   ├─ tech_stack: 기술 스택 목록
   ├─ architecture: 아키텍처 다이어그램
   ├─ structural_facts: 코드 구조 분석
   └─ areas: 프로젝트 영역별 분석

4. POST /{id}/quality-assessment
   ├─ 코드 품질 및 구현 난이도 사전 평가
   └─ 자동 평가 기반 리스크 식별
   
   ↓ 응답: ProjectQualityAssessmentRead
   ├─ qualitative_grade: "excellent" | "good" | "mediocre" | "poor"
   └─ quantitative_score: 0-100

5. PATCH /{id}/question-policy (선택사항)
   └─ Bloom 레벨별 질문 비율 조정 가능
   
   ↓ 응답: ProjectEvaluationRead

6. POST /{id}/questions/generate
   ├─ 컨텍스트 + RAG + Bloom 분류학 기반 질문 생성
   ├─ 질문마다 expected_answer와 scoring_rubric 포함
   └─ source_refs 포함 (코드/문서 근거 참고)
   
   ↓ 응답: list[InterviewQuestionRead]
   ├─ 상태 → "questions_generated"

7. GET /{id}/status (진행도 모니터링)
   └─ questions_ready, can_join, blocked_reason 등 확인
```

### 2. 학생 흐름

```
1. POST /{evaluation_id}/join
   ├─ participant_name: string (학생 이름)
   └─ request_client_id: 클라이언트 IP/ID (세션 위변조 방지)
   
   ↓ 응답: JoinEvaluationRead
   ├─ evaluation: ProjectEvaluationRead
   ├─ session: InterviewSessionRead (id, session_token)
   └─ interview_url_path: 접근 경로
   
   [session_token은 X-Session-Token 헤더 또는 interview_session_{session_id} 쿠키로 전달]

2. GET /{evaluation_id}/sessions/{session_id}/interview/state
   ├─ 인증: session_token (header 또는 cookie)
   └─ 현재 질문과 이전 답변 이력 조회
   
   ↓ 응답: StudentInterviewStateRead
   ├─ current_question_index: int
   ├─ total_questions: int
   ├─ question: InterviewQuestionRead (현재 질문)
   ├─ turns: list[InterviewTurnRead] (이전 답변들)
   └─ is_completed: bool

3. 학생 답변 제출 (3가지 모드)

   **A) 텍스트 직접 입력**
   POST /{evaluation_id}/sessions/{session_id}/interview/answer
   ├─ mode: "answer"
   ├─ answer_text: string (답변)
   ├─ current_question_id: str
   └─ draft_answer: string (선택사항, 임시 저장)
   
   ↓ 응답: InterviewTurnFlowResponse
   ├─ status: "need_follow_up" | "turn_submitted" | "ready_to_complete" | "completed"
   ├─ follow_up_question: 꼬리질문 (status가 "need_follow_up"일 때)
   ├─ turn: InterviewTurnRead (평가 점수 포함)
   └─ next_question: InterviewQuestionRead (다음 질문)

   **B) 오디오 음성 입력 (STT)**
   POST /{evaluation_id}/sessions/{session_id}/interview/transcribe
   ├─ audio: UploadFile (wav, mp3, m4a, ogg 지원)
   ├─ mode: "answer" | "follow_up"
   └─ 지원 최대 크기: OPENAI_AUDIO_MAX_UPLOAD_MB (환경 변수)
   
   ↓ 응답: InterviewTranscriptionRead
   └─ transcript: string (STT 결과 텍스트)
   
   [이후 transcript를 answer_text로 사용해 answer 엔드포인트 호출]

   **C) 음성 합성 (TTS, 선택사항)**
   POST /{evaluation_id}/sessions/{session_id}/interview/tts
   ├─ text: string (질문 텍스트)
   ├─ voice: str | null (OpenAI TTS 음성, 예: "nova")
   └─ instructions: str | null (음성 특성 지시)
   
   ↓ 응답: audio/mpeg (streaming)

4. 꼬리질문(Follow-up) 처리
   
   answer 응답이 status: "need_follow_up"이면:
   POST /{evaluation_id}/sessions/{session_id}/interview/answer
   ├─ mode: "follow_up"
   ├─ follow_up_question: string (학생의 추가 답변)
   ├─ follow_up_reason: string (추가 답변 이유)
   ├─ conversation_history: QuestionExchange (누적 대화)
   └─ current_question_id: str
   
   ↓ 응답: InterviewTurnFlowResponse
   ├─ status: "turn_submitted" (평가 완료) 또는 "need_follow_up" (추가 꼬리질문)
   ├─ turn: InterviewTurnRead (최종 평가)
   └─ next_question: InterviewQuestionRead (다음 질문) 또는 None

5. 인터뷰 진행

   모든 질문을 답변하면:
   
   POST /{evaluation_id}/sessions/{session_id}/interview/answer
   ├─ mode: "end" (또는 자동 감지)
   └─ 모든 질문 완료 신호
   
   ↓ 응답: InterviewTurnFlowResponse
   ├─ status: "completed"
   ├─ report: EvaluationReportRead (최종 리포트)
   └─ 상태 → "reported"

6. 인터뷰 완료 (명시적)
   POST /{evaluation_id}/sessions/{session_id}/interview/complete
   
   ↓ 응답: EvaluationReportRead

7. 인터뷰 중단 (선택사항)
   POST /{evaluation_id}/sessions/{session_id}/interview/abort
   
   ↓ 응답: EvaluationReportRead (중단 상태)

8. 최종 리포트 조회
   GET /{evaluation_id}/reports/latest
   
   ↓ 응답: EvaluationReportRead
   ├─ final_decision: "검증 통과" | "추가 확인 필요" | "신뢰 낮음"
   ├─ authenticity_score: 0-100
   ├─ total_score: 합계 점수
   ├─ area_analyses: 영역별 분석
   ├─ question_evaluations: 질문별 점수 및 분석
   ├─ bloom_summary: Bloom 레벨별 도달도
   ├─ strengths: 강점
   └─ weaknesses: 약점
```

---

## 세션 인증

### 토큰 발급
- `POST /{evaluation_id}/join`에서 `session_token` 발급
- 토큰은 PBKDF2 해싱되어 DB에 저장

### 토큰 전달
학생의 이후 요청에서 다음 중 하나로 전달:

1. **HTTP 헤더:**
   ```
   X-Session-Token: <token>
   ```

2. **쿠키:**
   ```
   Cookie: interview_session_{session_id}=<token>
   ```

### 검증
- 모든 학생 전용 엔드포인트(interview/*)에서 토큰 검증
- 토큰 불일치 또는 만료 시 401 에러
- 클라이언트 IP 검증으로 위변조 방지

---

## 오디오 처리

### STT (Speech-to-Text)

**엔드포인트:**
```
POST /{evaluation_id}/sessions/{session_id}/interview/transcribe
```

**지원 형식:**
- `.wav`, `.mp3`, `.m4a`, `.ogg`, `.flac` 등
- 최대 크기: `OPENAI_AUDIO_MAX_UPLOAD_MB` (기본 25MB)

**처리:**
- OpenAI Whisper API 사용 (model: `OPENAI_TRANSCRIBE_MODEL`)
- 반환: 인코딩된 텍스트

**에러 처리:**
```json
{
  "stage": "audio_transcription",
  "reason": "unsupported_audio_format|audio_too_large",
  "message": "설명",
  "supported_extensions": [...],
  "max_bytes": 26214400
}
```

### TTS (Text-to-Speech)

**엔드포인트:**
```
POST /{evaluation_id}/sessions/{session_id}/interview/tts
```

**요청:**
```json
{
  "text": "질문 텍스트",
  "voice": "nova",
  "instructions": "음성 특성 지시 (선택)"
}
```

**처리:**
- OpenAI TTS API 사용 (model: `OPENAI_TTS_MODEL`)
- 스트리밍 응답 (청크 단위)

**응답:**
- Content-Type: `audio/mpeg`
- Cache-Control: `no-store`

---

## 요청/응답 모델 상세

### ProjectEvaluationCreate (평가 생성)

```typescript
{
  name: string;                                    // 평가 이름 (1-200자)
  question_policy?: {                             // Bloom 질문 정책
    remember: number;
    understand: number;
    apply: number;
    analyze: number;
    evaluate: number;
    create: number;
  };
  evaluation_period_start?: Date | null;          // 평가 기간 시작
  evaluation_period_end?: Date | null;            // 평가 기간 종료
  expected_participant_count?: number | null;     // 예상 참여자 (1-500)
  project_category?: "weekly" | "midterm" | "final" | "capstone_final";  // 과제 유형
  focus_points?: string;                          // 평가 포인트 (0-2000자)
}
```

### ProjectEvaluationStatusRead (상태 조회)

```typescript
{
  evaluation_id: string;
  status: string;                     // "created" | "uploaded" | "analyzed" | ...
  phase: string;                      // 현재 진행 단계 설명
  has_artifacts: boolean;             // 자료 업로드 여부
  has_context: boolean;               // 컨텍스트 추출 여부
  has_quality_assessment: boolean;    // 품질 평가 여부
  rag_status: Record<string, any>;    // RAG 상태 (임베딩, 벡터DB 등)
  question_count: int;                // 현재 질문 개수
  expected_question_count: int;       // 예상 질문 개수
  questions_ready: boolean;           // 질문 생성 완료 여부
  can_generate_questions: boolean;    // 질문 생성 가능 여부
  can_join: boolean;                  // 학생 참여 가능 여부
  blocked_reason: string;             // 진행 불가 사유
  user_message: string;               // UI에 표시할 메시지
  check_targets: string[];            // 수행 필요 항목
  retryable: boolean;                 // 재시도 가능 여부
}
```

### InterviewTurnFlowResponse (답변 제출 응답)

```typescript
{
  status: "need_follow_up" | "turn_submitted" | "ready_to_complete" | "completed";
  message: string;
  draft_answer: string;               // 임시 저장된 답변
  follow_up_question?: string;        // 꼬리질문 (status="need_follow_up"일 때)
  follow_up_reason: string;           // 꼬리질문 이유
  next_mode?: "answer" | "follow_up" | "end" | null;  // 다음 모드
  turn?: InterviewTurnRead;           // 평가 결과
  next_question?: InterviewQuestionRead | null;  // 다음 질문
  report?: EvaluationReportRead;      // 최종 리포트 (status="completed"일 때)
  conversation_history?: QuestionExchange | null;  // 누적 대화 (follow-up 시)
}
```

### StudentInterviewStateRead (인터뷰 상태)

```typescript
{
  session_id: string;
  current_question_index: int;        // 현재 질문 인덱스 (0부터 시작)
  total_questions: int;               // 전체 질문 개수
  question?: InterviewQuestionRead;   // 현재 질문 또는 null (완료 시)
  turns: InterviewTurnRead[];         // 이전 답변 목록
  is_completed: boolean;              // 인터뷰 완료 여부
}
```

### InterviewTurnRead (단일 답변 평가)

```typescript
{
  id: string;
  session_id: string;
  question_id: string;
  question_text: string;
  answer_text: string;                // 학생 답변
  score: float;                       // 답변 점수
  evaluation_summary: string;         // 평가 요약
  rubric_scores: RubricScoreItem[];  // 루브릭별 점수
  evidence_matches: string[];         // 자료와 일치한 지점
  evidence_mismatches: string[];      // 자료와 불일치한 지점
  weaknesses: string[];               // 약점 분석
  strengths: string[];                // 강점 분석
  follow_up_question?: string | null; // 꼬리질문
  follow_up_reason: string;           // 꼬리질문 이유
  finalized_score?: float | null;     // 최종 점수 (follow-up 후)
  conversation_history?: QuestionExchange;  // 대화 이력
  created_at: datetime;
}
```

### EvaluationReportRead (최종 리포트)

```typescript
{
  id: string;
  evaluation_id: string;
  session_id: string;
  final_decision: "검증 통과" | "추가 확인 필요" | "신뢰 낮음";
  authenticity_score: float;          // 0-100 인증성 점수
  total_score: float;                 // 합계 점수
  total_max_score: float;             // 최대 점수
  summary: string;                    // 종합 평가 요약
  area_analyses: {                    // 프로젝트 영역별 분석
    area_name: string;
    confidence: float;
    findings: string[];
  }[];
  question_evaluations: {             // 질문별 평가
    question_id: string;
    question_text: string;
    student_answer: string;
    score: float;
    rubric_breakdown: RubricScoreItem[];
    evidence_alignment: {
      matches: string[];
      mismatches: string[];
    };
  }[];
  bloom_summary: {                    // Bloom 레벨별 도달도
    level: "기억" | "이해" | "적용" | "분석" | "평가" | "창안";
    attempted: int;
    achieved: int;
    percentage: float;
  }[];
  strengths: string[];                // 강점 목록
  weaknesses: string[];               // 약점 목록
  created_at: datetime;
}
```

---

## 실패 처리 및 에러 응답

### HTTP 에러 형식

모든 HTTP 에러는 다음 구조의 `detail` 객체 포함:

```json
{
  "stage": "artifact_upload|audio_transcription|audio_synthesis|...",
  "reason": "specific_error_code",
  "message": "사용자 친화적 메시지",
  ... (추가 컨텍스트)
}
```

### 주요 에러 상황

| HTTP | 단계 | 사유 | 메시지 |
|------|------|------|--------|
| 413 | audio_transcription | audio_too_large | 오디오 크기 초과 |
| 422 | audio_transcription | unsupported_audio_format | 지원하지 않는 형식 |
| 502 | audio_transcription | STT 처리 실패 | OpenAI API 에러 |
| 502 | audio_synthesis | TTS 처리 실패 | OpenAI API 에러 |
| 400 | session | invalid_session_token | 세션 토큰 검증 실패 |
| 409 | extraction | rag_ingestion_failed | RAG 임베딩 실패 |
| 422 | context | insufficient_context | 컨텍스트 부족 |

### 재시도 정책

- `ProjectEvaluationStatusRead.retryable = true` 인 경우만 재시도 권장
- 증분 백오프 권장: 1s, 2s, 4s, 8s, 16s (최대 5회)
- 거시적 작업(extract, generate) 실패 시 로그 수집 후 관리자 문의

---

## Realtime 라우터 (HTML 폴백)

### 엔드포인트

| 경로 | 설명 |
|------|------|
| `/interview/{eval_id}/{session_id}/open` | 세션 토큰 입력 폼 |
| `/interview/{eval_id}/{session_id}` | 단계형 HTML 인터뷰 (HTTP API 사용) |
| `/interview/{eval_id}/{session_id}/voice` | 음성 보조 화면 (선택) |

### 특징

- Next.js 불가 환경에서 최소 기능 인터뷰 제공
- 순수 HTML/JavaScript (의존성 최소)
- 모든 API 요청은 REST API 사용 (동일한 엔드포인트)
- 음성 transport 실패 시에도 텍스트 모드로 계속 진행 가능

---

## API 호출 예시

### 관리자: 평가 생성부터 질문 생성까지

```bash
# 1. 평가 생성
curl -X POST http://localhost:8000/api/project-evaluations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "캡스톤 프로젝트 평가",
    "project_category": "capstone_final",
    "focus_points": "아키텍처 설계 및 구현 근거"
  }'

# 2. ZIP 파일 업로드
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/artifacts/zip \
  -F "file=@project.zip"

# 3. 컨텍스트 추출
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/extract

# 4. 품질 사전 평가
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/quality-assessment

# 5. 질문 생성
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/questions/generate

# 6. 상태 확인
curl -X GET http://localhost:8000/api/project-evaluations/{eval_id}/status
```

### 학생: 인터뷰 진행

```bash
# 1. 참여
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/join \
  -H "Content-Type: application/json" \
  -d '{"participant_name": "김학생"}'

# 응답 예:
# {
#   "session": { "id": "sess_123", "session_token": "tok_456" }
# }

# 2. 인터뷰 상태 조회
curl -X GET http://localhost:8000/api/project-evaluations/{eval_id}/sessions/sess_123/interview/state \
  -H "X-Session-Token: tok_456"

# 3. 텍스트 답변 제출
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/sessions/sess_123/interview/answer \
  -H "X-Session-Token: tok_456" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "answer",
    "answer_text": "우리 프로젝트는 3-tier 아키텍처를 사용했습니다...",
    "current_question_id": "q_001"
  }'

# 4. 인터뷰 완료 (모든 질문 답변 후)
curl -X POST http://localhost:8000/api/project-evaluations/{eval_id}/sessions/sess_123/interview/complete \
  -H "X-Session-Token: tok_456"

# 5. 리포트 조회
curl -X GET http://localhost:8000/api/project-evaluations/{eval_id}/reports/latest
```

---

## 주요 설정 값 (환경 변수)

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `OPENAI_AUDIO_MAX_UPLOAD_MB` | 오디오 최대 크기 | 25 |
| `OPENAI_TRANSCRIBE_MODEL` | STT 모델 | whisper-1 |
| `OPENAI_TTS_MODEL` | TTS 모델 | tts-1 |
| `QDRANT_VECTOR_SIZE` | Qdrant 벡터 차원 | 1536 |
| `RAG_CHUNK_SIZE` | 문서 청크 크기 | 1024 |
| `RAG_OVERLAP` | 청크 오버랩 | 200 |

---

## 기술 노트

### 상태 계산 로직 (ProjectEvaluationStatusRead)

서버는 다음 조건에 따라 `can_generate_questions`, `can_join`, `questions_ready` 등을 자동 계산:

```
questions_ready = has_context AND question_count >= expected_question_count

can_generate_questions = has_context AND has_artifacts (status == analyzed)

can_join = questions_ready AND status == "questions_generated"
```

### 세션 위변조 방지

- 토큰: PBKDF2 해싱 (salt + iteration)
- 클라이언트 IP: 첫 join 시점과 이후 요청 비교
- 크로스 도메인: SameSite=Strict 쿠키 정책

### RAG 컨텍스트 생성

- Artifact Role별 분류 (코드, 문서, 설정, 테스트)
- Qdrant 벡터DB에 임베딩 (OpenAI embedding model)
- 질문 생성 시 top-k 의미 유사 문서 검색
- 답변 평가 시 근거 문서와 일치/불일치 추출

---

## 대기 중인 기능 (MVP 범위 외)

다음은 현재 미구현된 항목 (향후 추가 가능):

- [ ] 여러 학생 비교 분석
- [ ] 리포트 PDF export
- [ ] 재응시 정책
- [ ] 화상 감독
- [ ] 관리자 대시보드 고도화
- [ ] GraphQL 엔드포인트
- [ ] 배치 평가 (여러 평가 동시 진행)
