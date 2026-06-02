# Dialearn 도메인 모델

**최종 수정:** 2025-12-27

Dialearn은 AI 기반 프로젝트 수행 진위 검증 서비스다. 이 문서는 핵심 개념, 엔티티, 상태 전이, Bloom의 분류학을 정의한다.

---

## 1. 용어집

### 핵심 개념

| 용어 | 정의 |
|------|------|
| **평가 (Evaluation)** | 하나의 프로젝트 수행 진위 검증 단위. 교수자가 검증 과제를 생성하면 학생들이 참여하는 전체 생명주기를 관리한다. |
| **프로젝트 카테고리 (ProjectCategory)** | 평가의 유형. 주간 과제, 중간 과제, 기말 과제, 최종 과제 중 하나. |
| **포커스 포인트 (FocusPoints)** | 평가 시 특별히 주의하거나 강조할 영역. 자유 텍스트로 기술된 평가자의 지침. |
| **Artifact** | 제출된 개별 파일. ZIP 내부의 코드, 문서, 설정, 또는 텍스트로 추출된 자료 하나 하나. |
| **ArtifactRole** | Artifact의 역할 분류. 코드 근거와 문서 근거를 구분하고, 질문 생성 시 활용. |
| **ProjectContext** | 추출된 프로젝트 전체 맥락. 요약, 기술 스택, 기능, 아키텍처, 위험 요소 등을 포함. |
| **ProjectArea** | 프로젝트 내 세부 영역. 각 영역마다 질문을 생성하고 별도로 평가한다. |
| **QualityAssessment** | LLM 기반 프로젝트 품질 사전 평가. 프로젝트의 구조적 진정성을 정량적·정성적으로 판단. |
| **InterviewQuestion** | 생성된 검증 질문. Bloom 단계, 루브릭, 출처 참조, 의도(intent)를 포함. |
| **InterviewSession** | 한 학생의 인터뷰 진행 단위. 질문-답변-평가 턴들을 순차적으로 관리. |
| **InterviewTurn** | 질문-답변-평가 한 세트. 질문에 대한 최초 답변과 꼬리질문들의 누적 정보. |
| **RubricScore** | 루브릭 항목별 점수. 질문마다 정의된 여러 채점 기준과 각각의 획득 점수. |
| **EvaluationReport** | 최종 리포트. 학생의 전체 성적, 영역별 신뢰도, 강점/약점, 최종 판정. |

### Bloom의 분류학

| 단계 | 한글명 | 설명 |
|------|--------|------|
| `REMEMBER` | 기억 | 정보를 회상하는 가장 낮은 수준의 인지. |
| `UNDERSTAND` | 이해 | 정보의 의미를 파악하고 설명하는 수준. |
| `APPLY` | 적용 | 학습한 개념을 새로운 상황에 적용하는 수준. |
| `ANALYZE` | 분석 | 정보를 구성 요소로 분해하고 관계를 파악하는 수준. |
| `EVALUATE` | 평가 | 기준에 따라 판단하고 의견을 제시하는 수준. |
| `CREATE` | 창안 | 새로운 것을 만들거나 종합하는 가장 높은 수준. |

### ArtifactRole (10가지)

| Role | 설명 |
|------|------|
| `CODEBASE_SOURCE` | 프로젝트 주요 소스 코드 파일. |
| `CODEBASE_TEST` | 단위/통합 테스트 코드. |
| `CODEBASE_CONFIG` | 설정 파일 (package.json, requirements.txt, .env 등). |
| `CODEBASE_API_SPEC` | API 명세서 (OpenAPI/Swagger 등). |
| `CODEBASE_OVERVIEW` | 프로젝트 구조/모듈 설명 문서. |
| `PROJECT_REPORT` | 최종 보고서 (PDF, DOCX 등). |
| `PROJECT_PRESENTATION` | 발표 자료 (PPTX 등). |
| `PROJECT_DESIGN_DOC` | 설계 문서 (아키텍처, ERD, 플로우차트 등). |
| `PROJECT_DESCRIPTION` | 프로젝트 설명 텍스트 (README, 개요 문서). |
| `IGNORED` | 분석 대상이 아닌 파일 (바이너리, 임시 파일 등). |

### QualitativeGrade

| Grade | 설명 |
|-------|------|
| `EXCELLENT` | 우수 |
| `GOOD` | 양호 |
| `MEDIOCRE` | 보통 |
| `POOR` | 부족 |

### ProjectCategory와 한국어 레이블

| 값 | 한국어 레이블 |
|----|---------------|
| `WEEKLY` | 주간 과제 |
| `MIDTERM` | 중간 과제 |
| `FINAL` | 기말 과제 |
| `CAPSTONE_FINAL` | 최종 과제 |

### FinalDecision (최종 판정)

| 값 | 의미 |
|----|------|
| `검증 통과` | 프로젝트 수행 진정성이 높고 평가 완료 |
| `추가 확인 필요` | 신뢰도는 중간이며 추가 질문이나 검증 필요 |
| `신뢰 낮음` | 프로젝트 수행 진정성이 낮다고 판단됨 |

---

## 2. 핵심 엔티티 관계도

```
┌─────────────────────────────────────────────────────────────┐
│                     Evaluation (평가)                       │
│ - id, name, status, question_policy                         │
│ - project_category, focus_points                            │
│ - evaluation_period_start/end                               │
│ - expected_participant_count                                │
│ - created_at, updated_at                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┬────────────────┐
        │              │              │              │                │
        ▼              ▼              ▼              ▼                ▼
    Artifact     ProjectContext  QualityAssess  ProjectArea   InterviewQuestion
    (1→N)           (1→1)          (1→1)          (1→N)            (1→N)
  - source_path  - summary      - qualitative  - name         - question
  - source_type  - tech_stack   _grade        - summary       - intent
  - status       - features     - quantitative - role_in_      - bloom_level
  - raw_text     - architecture _score        project         - expected_answer
  - char_count   - student_risks - workload    - key_concerns  - scoring_rubric
  - metadata     - structural   _baseline     - source_refs    - max_points
                  _facts        - summary                      - source_refs
                  - question    - strengths                    - order_index
                  _targets      - concerns                     - project_area_id
                  - areas       - rationale
                               - evidence_refs
                               - model_name

        ┌──────────────────────────────────────────────────────────┐
        │           InterviewSession (인터뷰 세션)                 │
        │ - id, evaluation_id, participant_name                    │
        │ - session_token, status                                  │
        │ - current_question_index                                 │
        │ - created_at, completed_at                               │
        └──────────────────────┬───────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
              InterviewTurn         EvaluationReport
              (1→N)                  (1→1)
            - question_text        - final_decision
            - answer_text          - authenticity_score
            - score                - total_score
            - evaluation_          - total_max_score
              summary              - summary
            - rubric_scores        - area_analyses
            - evidence_matches     - question_evaluations
            - evidence_mismatches  - bloom_summary
            - weaknesses           - strengths
            - strengths            - weaknesses
            - follow_up_question   - created_at
            - conversation_
              history

                      │
                      ▼
                 RubricScore
                 (1→N)
               - criterion
               - criterion_index
               - score
               - max_points
               - rationale
```

**관계 요약:**
- Evaluation 1:N Artifact (파일 제출)
- Evaluation 1:1 ProjectContext (분석 결과)
- Evaluation 1:1 QualityAssessment (품질 평가)
- Evaluation 1:N ProjectArea (영역 분해)
- Evaluation 1:N InterviewQuestion (질문 생성)
- ProjectArea 1:N InterviewQuestion (각 영역별 질문)
- Evaluation 1:N InterviewSession (학생별 세션)
- InterviewSession 1:N InterviewTurn (Q&A 턴)
- InterviewTurn 1:N RubricScore (채점 항목)
- InterviewSession 1:1 EvaluationReport (최종 리포트)

---

## 3. Evaluation 상태 전이

```
                    ┌─────────────────────────────────────────┐
                    │ CREATED                                 │
                    │ (평가 생성, 아직 자료 없음)              │
                    └────────────┬────────────────────────────┘
                                 │
                    (ZIP 업로드 및 파일 추출)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ UPLOADED                                │
                    │ (자료 추출 완료)                         │
                    └────────────┬────────────────────────────┘
                                 │
                    (RAG 분석, ProjectContext 추출)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ ANALYZED                                │
                    │ (ProjectContext, Areas 생성)            │
                    │ (QualityAssessment 선택)                │
                    └────────────┬────────────────────────────┘
                                 │
                    (질문 생성 요청)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ QUESTIONS_GENERATED                     │
                    │ (Bloom별 질문 완성, 학생 참여 가능)      │
                    └────────────┬────────────────────────────┘
                                 │
                    (학생 세션 참여, Q&A 진행)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ INTERVIEWING                            │
                    │ (최소 1명 이상 세션 진행 중)             │
                    └────────────┬────────────────────────────┘
                                 │
                    (모든 학생 완료, 리포트 생성)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ REPORTED                                │
                    │ (최종 리포트 생성 완료)                  │
                    └─────────────────────────────────────────┘
```

**상태별 의미:**
- `CREATED`: 평가만 생성, 자료 없음
- `UPLOADED`: Artifact 추출 완료
- `ANALYZED`: ProjectContext, Areas, 선택적 QualityAssessment 완성
- `QUESTIONS_GENERATED`: Bloom별 질문 모두 생성 완료, 학생 참여 가능
- `INTERVIEWING`: 1명 이상 InterviewSession이 진행 중
- `REPORTED`: 모든 세션 완료, EvaluationReport 생성

---

## 4. InterviewSession 상태 전이

```
                    ┌─────────────────────────────────────────┐
                    │ CREATED                                 │
                    │ (세션 방금 생성, 첫 질문 미노출)        │
                    └────────────┬────────────────────────────┘
                                 │
                    (학생 첫 진입, 첫 질문 로드)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ IN_PROGRESS                             │
                    │ (질문 로드, 답변 입력 중)                │
                    │ (current_question_index >= 0)           │
                    └────────────┬────────────────────────────┘
                                 │
                    (모든 질문 완료, 최종 답변 제출)
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ COMPLETED                               │
                    │ (세션 종료, completed_at 기록)          │
                    │ (EvaluationReport 생성)                 │
                    └─────────────────────────────────────────┘
```

**상태별 의미:**
- `CREATED`: 세션 생성 직후, 질문 미노출
- `IN_PROGRESS`: 학생이 질문 로드 및 답변 입력 중
- `COMPLETED`: 모든 질문 완료, 세션 종료

---

## 5. InterviewTurn 상태 및 흐름

### InterviewTurnFlowStatus (turn 단계 상태)

```
            최초 답변 (ANSWER 모드)
                    │
                    ▼
          ┌─────────────────────┐
          │ TURN_SUBMITTED      │
          │ (1차 답변 제출)      │
          └──────────┬──────────┘
                     │
        (LLM이 답변 평가, 꼬리질문 필요 여부 판단)
                     │
         ┌───────────┴───────────┐
         │                       │
    꼬리 필요              꼬리 불필요
         │                       │
         ▼                       ▼
    ┌──────────────┐      ┌─────────────────┐
    │NEED_FOLLOW_UP│      │READY_TO_COMPLETE│
    │(꼬리질문 추천)│      │(바로 완료 가능)  │
    └──────┬───────┘      └────────┬────────┘
           │                        │
    (학생 꼬리답변 제시)     (COMPLETE 요청)
           │                        │
           └───────────┬────────────┘
                       │
                       ▼
              ┌─────────────────────┐
              │ COMPLETED           │
              │ (turn 완료, 최종점수) │
              └─────────────────────┘
```

### InterviewTurnMode (turn의 입력 모드)

| 모드 | 설명 |
|------|------|
| `ANSWER` | 첫 번째 답변 입력 (turn 생성) |
| `FOLLOW_UP` | 꼬리질문에 대한 답변 입력 |
| `END` | 세션 종료 (답변 없이 끝내기) |

**흐름:**
1. 학생이 ANSWER 모드로 첫 답변 제출
2. 서버가 LLM으로 평가하고 꼬리질문 필요 여부 판단
3. NEED_FOLLOW_UP이면 학생이 FOLLOW_UP 모드로 꼬리답변 제시
4. READY_TO_COMPLETE이거나 꼬리 완료 후 COMPLETE 요청하면 COMPLETED

---

## 6. Artifact 상태

| 상태 | 의미 |
|------|------|
| `EXTRACTED` | 파일 추출 및 텍스트화 성공 |
| `SKIPPED` | 파일 형식 미지원 또는 크기 초과로 스킵됨 |
| `FAILED` | 추출 중 오류 발생 |

**ArtifactSourceType:**
- `ZIP`: ZIP 파일로부터 추출된 파일
- `DOCUMENT`: PDF/DOCX 등 문서 파일
- `CODE`: 소스 코드 파일
- `TEXT`: 텍스트 파일
- `IGNORED`: 무시된 파일

---

## 7. QuestionGenerationPolicy (질문 생성 정책)

질문 생성 시 Bloom 단계별 질문 배분을 제어한다.

```python
# 예시
policy = QuestionGenerationPolicy(
    total_question_count=6,
    bloom_ratios={
        "기억": 1,
        "이해": 1,
        "적용": 1,
        "분석": 1,
        "평가": 1,
        "창안": 1,
    }
)
# → bloom_distribution: {"기억": 1, "이해": 1, "적용": 1, "분석": 1, "평가": 1, "창안": 1}
```

**필드:**
- `total_question_count`: 총 질문 수 (기본 6, 범위 1-20)
- `bloom_ratios`: Bloom 단계별 비율 (기본 각 1)
  - 값은 0-10 사이의 정수
  - 합이 0이면 오류
  - 실제 질문 개수는 비율에 따라 선택적으로 배분
- `bloom_distribution`: 정규화된 결과 분배 (자동 계산)

**배분 알고리즘:**
- 총 질문 수 × (각 단계 비율 / 합계) 계산
- 소수점 이하는 버림, 남은 개수는 가장 큰 소수점 값부터 라운드업

---

## 8. InterviewQuestion (질문)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `evaluation_id` | 소속 평가 ID |
| `project_area_id` | 소속 ProjectArea ID (선택사항) |
| `question` | 검증 질문 텍스트 |
| `intent` | 질문의 의도/목표 (왜 이 질문을 하는가) |
| `bloom_level` | Bloom 단계 |
| `expected_answer` | 모범 답변 (평가 기준) |
| `scoring_rubric` | 채점 기준 목록 (ScoringRubricItem[]) |
| `max_points` | 최대 점수 |
| `source_refs` | 출처 참고 (SourceReference[]) |
| `order_index` | 질문 순서 (0부터 시작) |
| `created_at` | 생성 일시 |

**ScoringRubricItem:**
- `description`: 채점 기준 설명
- `points`: 해당 기준의 점수

**SourceReference:**
- `path`: 파일 경로 또는 문서 위치
- `snippet`: 해당 부분의 텍스트 발췌
- `artifact_id`: 출처 Artifact ID
- `page_or_slide`: PDF 페이지 또는 슬라이드 번호
- `line_start`, `line_end`: 코드 라인 범위
- `artifact_role`: 출처의 역할 (CODEBASE_SOURCE 등)
- `chunk_type`: 청크 타입 (code, text, table 등)

---

## 9. InterviewTurn (Q&A 턴)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `session_id` | 소속 세션 ID |
| `question_id` | 질문 ID |
| `question_text` | 질문 텍스트 (기록용) |
| `answer_text` | 학생 최초 답변 |
| `score` | LLM 평가 점수 |
| `evaluation_summary` | LLM 평가 요약 |
| `rubric_scores` | 채점 기준별 점수 배열 (RubricScoreItem[]) |
| `evidence_matches` | 자료 근거와의 일치점 |
| `evidence_mismatches` | 자료 근거와의 불일치점 |
| `weaknesses` | 약점 지적 |
| `strengths` | 강점 인정 |
| `follow_up_question` | LLM 생성 꼬리질문 (선택사항) |
| `follow_up_reason` | 꼬리질문 이유 |
| `finalized_score` | 모든 꼬리 완료 후 최종 점수 (선택사항) |
| `conversation_history` | 누적 Q&A 대화 (QuestionExchange) |
| `created_at` | 생성 일시 |

**RubricScoreItem:**
- `criterion`: 채점 기준
- `criterion_index`: 해당 기준의 인덱스
- `score`: 획득 점수
- `max_points`: 최대 점수
- `rationale`: 채점 근거

**QuestionExchange (대화 누적):**
- `student_answer`: 최초 답변 텍스트
- `follow_ups[]`: 꼬리질문 배열
  - `question`: 꼬리질문
  - `answer`: 학생 꼬리답변
  - `reason`: 꼬리질문 이유
  - `target_rubric_index`: 보충하려던 채점 기준 인덱스 (같은 기준 중복 방지)

---

## 10. RubricScore (채점 기준별 점수)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `turn_id` | 소속 InterviewTurn ID |
| `criterion` | 채점 기준 문구 |
| `criterion_index` | 기준 인덱스 |
| `score` | 획득 점수 |
| `max_points` | 최대 점수 |
| `rationale` | 채점 근거 |

**용도:** 질문마다 여러 채점 기준(예: 정확성, 완전성, 자료 기반성)이 있으며, 각각에 대해 LLM이 점수와 근거를 기록한다.

---

## 11. EvaluationReport (최종 리포트)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `evaluation_id` | 평가 ID |
| `session_id` | 세션 ID |
| `final_decision` | 최종 판정 (검증 통과 / 추가 확인 필요 / 신뢰 낮음) |
| `authenticity_score` | 진정성 점수 (0-100) |
| `total_score` | 총 점수 |
| `total_max_score` | 최대 점수 (기본 100) |
| `summary` | 종합 평가 요약 |
| `area_analyses` | 영역별 상세 분석 배열 |
| `question_evaluations` | 질문별 평가 배열 |
| `bloom_summary` | Bloom 단계별 도달도 요약 |
| `strengths` | 프로젝트 강점 목록 |
| `weaknesses` | 개선 필요 약점 목록 |
| `created_at` | 생성 일시 |

**area_analyses 예시:**
```json
{
  "area_id": "...",
  "area_name": "Backend API",
  "summary": "RESTful API 설계 및 구현은 양호...",
  "confidence": 0.85,
  "question_indices": [0, 2, 5]
}
```

**question_evaluations 예시:**
```json
{
  "question_index": 0,
  "question": "프로젝트의 주요 기술 스택은?",
  "bloom_level": "기억",
  "max_score": 10,
  "achieved_score": 8,
  "rubric_scores": [...]
}
```

**bloom_summary 예시:**
```json
{
  "기억": { "count": 1, "avg_score": 8.0 },
  "이해": { "count": 1, "avg_score": 8.5 },
  "적용": { "count": 1, "avg_score": 7.0 },
  ...
}
```

---

## 12. ProjectContext (추출된 프로젝트 맥락)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `evaluation_id` | 평가 ID (1:1 관계) |
| `summary` | 프로젝트 전체 요약 |
| `tech_stack` | 기술 스택 배열 (TechStackItem[]) |
| `features` | 주요 기능 목록 |
| `architecture` | 아키텍처 정보 (ArchitectureRead) |
| `student_implementation_risks` | 학생이 직면할 구현 위험 요소 |
| `structural_facts` | 구조적 사실 (파일 수, LOC, 테스트 비율 등) |
| `question_targets` | 질문 생성 대상 영역 목록 |
| `rag_status` | RAG/LLM 처리 상태 메타정보 |
| `areas` | ProjectArea 배열 |
| `created_at` | 생성 일시 |

**TechStackItemRead:**
- `name`: 기술 이름 (예: React, PostgreSQL)
- `category`: 카테고리 (frontend, backend, database 등)
- `role_in_project`: 프로젝트에서의 역할
- `evidence_path`: 근거 파일 경로

**ArchitectureRead:**
- `style`: 아키텍처 스타일 (MVC, Microservices 등)
- `summary`: 아키텍처 설명
- `layers`: 레이어 목록
- `modules`: 모듈 목록
- `nodes[]`: 컴포넌트 노드 (id, label, layer)
- `edges[]`: 의존성 엣지 (source, target, label)

**StudentImplementationRiskRead:**
- `area`: 위험 영역
- `challenge`: 구체적 도전 과제
- `why_difficult`: 어려운 이유
- `evidence_path`: 근거 경로

**StructuralFactsRead:**
- `file_count`: 총 파일 수
- `code_file_count`: 코드 파일 수
- `doc_file_count`: 문서 파일 수
- `total_loc`: 총 라인 수
- `test_ratio`: 테스트 코드 비율
- `language_loc[]`: 언어별 LOC
- `file_tree[]`: 파일 트리 구조
- `dependencies[]`: 의존성 목록
- `entry_point_candidates[]`: 진입점 후보
- `readme_outline[]`: README 아웃라인

---

## 13. ProjectQualityAssessment (품질 평가)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `evaluation_id` | 평가 ID (1:1 관계) |
| `qualitative_grade` | 정성적 등급 (EXCELLENT/GOOD/MEDIOCRE/POOR) |
| `quantitative_score` | 정량적 점수 (0-100) |
| `workload_baseline` | 예상 작업량 기준선 (경량/중간/대형) |
| `summary` | 평가 요약 |
| `strengths` | 강점 목록 |
| `concerns` | 우려사항 목록 |
| `rationale` | 평가 근거 |
| `evidence_refs` | 근거 참고 문헌 |
| `model_name` | LLM 모델 이름 |
| `created_at` | 생성 일시 |

**용도:** 질문 생성 전에 프로젝트의 구조적/진정성 품질을 사전 평가한다. 이후 인터뷰 깊이 조정에 활용될 수 있다.

---

## 14. ProjectArea (프로젝트 영역)

| 필드 | 설명 |
|------|------|
| `id` | 고유 식별자 |
| `evaluation_id` | 평가 ID |
| `name` | 영역 이름 (예: "Backend API", "Database Schema") |
| `summary` | 영역 설명 |
| `role_in_project` | 프로젝트에서의 역할 |
| `key_concerns` | 주요 우려사항 목록 |
| `source_refs` | 출처 참고 |

**용도:** 프로젝트를 여러 영역으로 분해하고, 각 영역별로 질문을 생성하며, 최종 리포트에서도 영역별 신뢰도를 기록한다.

---

## 15. 데이터베이스 테이블 매핑

| 테이블 | 주요 필드 | 관계 |
|--------|---------|------|
| `project_evaluations` | id, name, status, question_policy_json, project_category, focus_points | PK: id |
| `project_artifacts` | id, evaluation_id, source_path, source_type, status, raw_text, char_count, metadata_json | FK: evaluation_id |
| `extracted_project_contexts` | id, evaluation_id, summary, tech_stack_json, features_json, architecture_json, ... | FK: evaluation_id (UNIQUE) |
| `project_quality_assessments` | id, evaluation_id, qualitative_grade, quantitative_score, workload_baseline, ... | FK: evaluation_id (UNIQUE) |
| `project_areas` | id, evaluation_id, name, summary, role_in_project, key_concerns_json, source_refs_json | FK: evaluation_id |
| `interview_questions` | id, evaluation_id, project_area_id, question, intent, bloom_level, scoring_rubric_json, max_points, source_refs_json, order_index | FK: evaluation_id, project_area_id |
| `interview_sessions` | id, evaluation_id, participant_name, session_token_hash, status, current_question_index, created_at, completed_at | FK: evaluation_id |
| `interview_turns` | id, session_id, question_id, question_text, answer_text, score, evaluation_summary, rubric_scores_json, evidence_matches_json, evidence_mismatches_json, ... | FK: session_id, question_id (UNIQUE: session_id+question_id) |
| `rubric_scores` | id, turn_id, criterion, criterion_index, score, max_points, rationale | FK: turn_id |
| `evaluation_reports` | id, evaluation_id, session_id, final_decision, authenticity_score, total_score, summary, area_analyses_json, question_evaluations_json, bloom_summary_json, ... | FK: evaluation_id, session_id |

---

## 16. 핵심 불변식 (Invariants)

1. **Evaluation 상태 순서:** CREATED < UPLOADED < ANALYZED < QUESTIONS_GENERATED < INTERVIEWING < REPORTED
2. **InterviewSession 1:1 Artifact:** 각 세션은 정확히 하나의 평가에 속함
3. **InterviewTurn 고유성:** (session_id, question_id) 조합이 유일함 (한 질문에 한 턴만)
4. **ProjectArea-Question 링크:** question의 project_area_id는 같은 evaluation_id를 가진 area를 가리킴
5. **Bloom 질문 분배:** 생성된 질문의 bloom_level별 개수는 bloom_distribution을 따름
6. **FinalDecision 유효성:** 리포트의 final_decision은 인터뷰 응답 내용과 루브릭 점수에 기반함

---

## 17. 설계 이력 참고

자세한 아키텍처 결정 사항은 다음 문서를 참고:
- `docs/project-evaluation-scope.md`: MVP 범위, 도메인 모델 초안
- `docs/architecture-decisions.md`: 설계 선택과 이유
- `docs/rag-ingestion-and-retrieval.md`: RAG 인제스션 및 출처 관리
- `docs/api-and-job-flow.md`: API 엔드포인트와 상태 전이
- `docs/security-and-data-policy.md`: 데이터 관리 정책

---

**문서 버전:** 1.0  
**작성 일자:** 2025-12-27  
**마지막 검수:** 코드베이스 기반 검증 완료
