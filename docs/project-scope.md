# 프로젝트 범위

**한 줄 정의**: AI 기반 프로젝트 수행 진위 검증 서비스

**핵심 질문**: 이 학생이 이 프로젝트를 진짜로 수행했는가?

## MVP 입력

학생이 다음 중 하나 또는 모두를 제출한다.

### 1. ZIP 파일
단일 zip 아카이브 내에 다음 자료가 포함될 수 있다.
- 프로젝트 소스 코드 (Python, JavaScript, Java 등)
- README.md 또는 프로젝트 설명
- PDF 보고서
- PowerPoint 발표자료
- Word 설계 문서
- API 명세서
- 기타 텍스트/마크다운 문서

### 2. GitHub URL
공개 GitHub 리포지토리 URL (실제 구현됨)
- 자동으로 clone하고 압축하여 처리

**제외**: 개별 파일 업로드, private GitHub URL

## MVP 처리 흐름

```
1. 자료 업로드 (zip 또는 GitHub)
   ↓
2. 추출 및 분류
   - Artifact role 분류 (코드, 문서, 설정, API 명세 등)
   - 파일별 처리 상태 추적
   ↓
3. 프로젝트 컨텍스트 분석
   - 코드 인덱싱 및 벡터화 (Qdrant)
   - 문서 섹션 추출
   - 코드-문서 연결 가능성 파악
   ↓
4. 프로젝트 품질 평가
   - 복잡성, 구조, 문서화 정도 자동 평가
   ↓
5. 질문 생성
   - Bloom's Taxonomy 기반 단계별 질문
   - 코드 근거 + 문서 근거 + alignment 검증 질문
   ↓
6. 인터뷰 (텍스트 + 음성)
   - 학생이 질문에 텍스트 또는 음성으로 답변
   - 자동 조팡질문 생성
   - 최종 인터뷰 완료 또는 중단
   ↓
7. 리포트 생성
   - 영역별 신뢰도 평가
   - 질문별 루브릭 점수
   - Bloom 단계별 도달도
   - 최종 판정 (검증 통과 / 추가 확인 필요 / 신뢰 낮음)
```

## MVP 출력

### 평가 리포트
최종 판정:
- **검증 통과** (Verified)
- **추가 확인 필요** (Needs Followup)
- **신뢰 낮음** (Low Confidence)

### 리포트 구성 요소
- 프로젝트 영역별 신뢰도
- 질문별 루브릭 점수
  - 자료 근거 일치도
  - 구현 구체성
  - 구조 이해도
  - 의사결정 이해도
  - 트러블슈팅 경험
  - 한계 인식
  - 답변 일관성
- Bloom 단계별 도달도
  - 기억 (Remember)
  - 이해 (Understand)
  - 적용 (Apply)
  - 분석 (Analyze)
  - 평가 (Evaluate)
  - 창안 (Create)
- 자료 근거와 답변의 일치/불일치
- 의심 지점
- 강점
- 추가 확인 질문

## 평가 방법

### Bloom's Taxonomy
질문의 인지 수준과 검증 깊이를 설계하는 기준. 6단계 단계별로 질문을 구성한다.

### 루브릭 기반 평가
답변의 다음 항목을 평가한다:
- 자료 근거 일치도: 학생이 제시한 문서/코드와 답변이 얼마나 일치하는가
- 구현 구체성: 추상적 설명이 아닌 실제 구현 세부사항을 알고 있는가
- 구조 이해도: 전체 프로젝트 아키텍처와 설계 의도를 이해하고 있는가
- 의사결정 이해도: 기술 선택, 설계 결정의 이유를 설명할 수 있는가
- 트러블슈팅 경험: 개발 중 마주친 문제와 해결 방식을 기억하고 있는가
- 한계 인식: 프로젝트의 제한사항과 개선점을 인식하고 있는가
- 답변 일관성: 이전 답변과 모순되지 않는가

## 평가 대상 엔티티

### EvaluationStatus (상태)
- `created` - 평가 생성됨
- `uploaded` - 자료 업로드됨
- `analyzed` - 프로젝트 컨텍스트 분석 완료
- `questions_generated` - 질문 생성 완료
- `interviewing` - 인터뷰 진행 중
- `reported` - 리포트 생성 완료

### ArtifactRole (자료 역할)
- `codebase_source` - 주요 소스 코드
- `codebase_test` - 테스트 코드
- `codebase_config` - 설정 파일
- `codebase_api_spec` - API 명세
- `codebase_overview` - 코드 개요 (README.md 등)
- `project_report` - 최종 보고서 (PDF)
- `project_presentation` - 발표자료 (PPTX)
- `project_design_doc` - 설계 문서 (DOCX)
- `project_description` - 텍스트 설명
- `ignored` - 무시됨

### BloomLevel (Bloom 단계)
- `기억` (Remember) - 사실 회상
- `이해` (Understand) - 개념 이해
- `적용` (Apply) - 실제 적용
- `분석` (Analyze) - 요소 분석
- `평가` (Evaluate) - 판단 및 평가
- `창안` (Create) - 새로운 것 창작

### FinalDecision (최종 판정)
- `검증 통과` (Verified)
- `추가 확인 필요` (Needs Followup)
- `신뢰 낮음` (Low Confidence)

### InterviewSessionStatus (인터뷰 세션 상태)
- `created` - 세션 생성됨
- `in_progress` - 인터뷰 진행 중
- `completed` - 인터뷰 완료

### InterviewTurnMode (답변 방식)
- `answer` - 초기 질문에 대한 답변
- `follow_up` - 조팡질문에 대한 답변
- `end` - 인터뷰 종료

## API 엔드포인트

### 평가 생성 및 관리
- `POST /api/project-evaluations` - 평가 생성
- `GET /api/project-evaluations` - 평가 목록 조회
- `GET /api/project-evaluations/{evaluation_id}` - 평가 상세 조회
- `GET /api/project-evaluations/{evaluation_id}/status` - 평가 상태 조회

### 자료 업로드
- `POST /api/project-evaluations/{evaluation_id}/artifacts/zip` - ZIP 파일 업로드
- `POST /api/project-evaluations/{evaluation_id}/artifacts/github` - GitHub URL 가져오기
- `GET /api/project-evaluations/{evaluation_id}/artifacts` - 업로드된 자료 목록

### 분석 및 처리
- `POST /api/project-evaluations/{evaluation_id}/extract` - 프로젝트 컨텍스트 추출
- `GET /api/project-evaluations/{evaluation_id}/context` - 추출된 컨텍스트 조회
- `POST /api/project-evaluations/{evaluation_id}/quality-assessment` - 품질 평가 실행
- `GET /api/project-evaluations/{evaluation_id}/quality-assessment` - 품질 평가 결과 조회

### 질문 생성
- `POST /api/project-evaluations/{evaluation_id}/questions/generate` - 질문 생성
- `GET /api/project-evaluations/{evaluation_id}/questions` - 생성된 질문 목록

### 인터뷰
- `POST /api/project-evaluations/{evaluation_id}/sessions` - 인터뷰 세션 생성
- `GET /api/project-evaluations/{evaluation_id}/sessions` - 세션 목록
- `GET /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/state` - 현재 인터뷰 상태
- `POST /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/answer` - 질문 답변 제출 (텍스트)
- `POST /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/transcribe` - 음성 전사 (STT)
- `POST /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/tts` - 음성 합성 (TTS)
- `POST /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/complete` - 인터뷰 완료
- `POST /api/project-evaluations/{evaluation_id}/sessions/{session_id}/interview/abort` - 인터뷰 중단

### 리포트
- `GET /api/project-evaluations/{evaluation_id}/reports` - 생성된 리포트 목록
- `GET /api/project-evaluations/{evaluation_id}/reports/latest` - 최신 리포트 조회
- `GET /api/project-evaluations/{evaluation_id}/reports/{report_id}` - 리포트 상세 조회

## 제외 범위

다음은 MVP에서 명시적으로 제외한다.

### 도메인 기능
- 강의실 (classroom) 관리
- 학생/교수자 역할 관리
- 학교 로그인/인증 시스템
- 일반 시험 생성 (프로젝트 수행 검증만 수행)
- 성적 관리
- 학습 대시보드
- 재응시 정책
- 관리자 비밀번호 기반 방 관리
- 복잡한 권한 시스템

### 기능
- 여러 학생의 프로젝트 비교
- 리포트 PDF export
- 이력 관리 (재평가 추적)
- 프로젝트 평가 공유

### 기술
- 화상 감독
- 카메라/마이크 권한 기반 감시
- 복잡한 접근 제어 (RBAC)

## 작업 원칙

1. **근본 원인 추적**: 실패를 `try/except`나 조용한 fallback으로 숨기지 않는다. 근본 원인과 실패 상태를 API/UI에서 추적 가능하게 드러낸다.

2. **최소 범위**: 프로젝트 수행 진위 검증에 직접 필요하지 않은 기능은 추가하지 않는다.

3. **기능 우선**: 캡스톤 시연용 프로젝트이므로 기능 구현을 우선하고, 비필수 보안 요구는 완화할 수 있다. 단, 기본 안전성 (자료 추출 안전장치, 파일 제한, 세션 인증)은 유지한다.
