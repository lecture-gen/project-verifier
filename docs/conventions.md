# Dialearn 코딩 컨벤션

이 문서는 **Dialearn** — 프로젝트 진위 검증 AI 플랫폼의 코딩 규칙을 정의합니다.

---

## 1. 백엔드 (Python / FastAPI)

### 버전 및 패키지 관리

- **Python 3.13+** (pyproject.toml에 명시)
- **uv** (pip 대신 사용)
- **의존성 추가**: `uv add <package>` (pyproject.toml 자동 갱신)
- **개발 모드 실행**: `uv run uvicorn app.main:app --reload`

### Linting 및 포맷팅

- **Ruff**: 린팅 + 포맷팅 일괄 관리
  - 체크: `uv run ruff check .`
  - 포맷: `uv run ruff format .`
  - 설정: `pyproject.toml` 의 `[tool.ruff]`
- **console.log 대신 logging 모듈 사용**:
  ```python
  import logging
  _logger = logging.getLogger(__name__)
  _logger.error("error message")
  ```

### Pydantic v2 모델

**OpenAPI / API 응답** 및 **도메인 모델**은 Pydantic으로 정의합니다.

```python
from pydantic import BaseModel, ConfigDict

class ProjectEvaluationRead(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)  # ORM 호환성
```

**원칙**:
- 모든 필드에 타입 명시
- API 응답 모델은 `*Read`, `*Create`, `*Update` 등으로 네이밍
- `from_attributes=True` 필수 (SQLAlchemy ORM → Pydantic 변환)

### SQLAlchemy 2.x 패턴

**ORM 모델** (데이터베이스 테이블 매핑):
```python
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime

class ProjectEvaluationRow(Base):
    __tablename__ = "project_evaluations"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="created")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now
    )
```

**원칙**:
- `Mapped[T]` 타입 어노테이션 필수
- `mapped_column()` 메서드 사용 (구식 `Column()` 사용 금지)
- 타임스탬프는 UTC: `DateTime(timezone=True)`, `utc_now` 기본값

#### JSON 필드 저장 패턴

복잡한 객체는 JSON 문자열로 저장합니다.

```python
class ExtractedProjectContextRow(Base):
    __tablename__ = "extracted_project_contexts"
    
    tech_stack_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )
    features_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="[]"
    )
    architecture_json: Mapped[str] = mapped_column(
        Text, nullable=False, default="{}"
    )
```

**원칙**:
- 컬럼명 후미에 `_json` 붙임
- ORM 모델: Text 타입으로 저장 (SQLite3 사용)
- Repository 계층: `json.loads()` / `json.dumps()` 처리
- Pydantic 모델: 실제 리스트/딕셔너리 타입 사용

### 도메인 모델 구조

도메인 모델은 **주제별 모듈**로 분리합니다.

```
app/project_evaluations/domain/
├── models.py          # 모든 모델 재수출 (backward compat)
├── evaluation.py      # 평가(evaluation) 도메인
├── artifact.py        # 자료(artifact) 도메인
├── interview.py       # 면접(interview) 도메인
├── question.py        # 질문(question) 도메인
├── report.py          # 리포트(report) 도메인
├── session.py         # 세션(session) 도메인
├── quality.py         # 품질 평가(quality) 도메인
├── bloom.py           # Bloom's Taxonomy 로직
├── common.py          # 공통 모델 (SourceReference, RubricScoreItem 등)
└── enums.py           # StrEnum 정의
```

**models.py는 모든 sub-module에서 재수출합니다** (기존 코드 호환성):
```python
from app.project_evaluations.domain.artifact import (
    ArtifactUploadResult,
    ExtractedProjectContextRead,
    ProjectAreaRead,
)
from app.project_evaluations.domain.evaluation import (
    ProjectEvaluationRead,
    ProjectEvaluationCreate,
)
# ... 기타 모듈들 ...

__all__ = [
    "ArtifactUploadResult",
    "ExtractedProjectContextRead",
    "ProjectEvaluationRead",
    # ...
]
```

### Enum 규칙

모든 Enum은 **StrEnum** 사용:

```python
from enum import StrEnum

class EvaluationStatus(StrEnum):
    CREATED = "created"
    UPLOADED = "uploaded"
    ANALYZED = "analyzed"

class BloomLevel(StrEnum):
    REMEMBER = "기억"      # 한글 표시값
    UNDERSTAND = "이해"
    APPLY = "적용"
    ANALYZE = "분석"
    EVALUATE = "평가"
    CREATE = "창안"

class InterviewTurnMode(StrEnum):
    ANSWER = "answer"      # 영문 ID
    FOLLOW_UP = "follow_up"
    END = "end"
```

**원칙**:
- StrEnum 사용 (문자열 호환, JSON 직렬화 용이)
- 도메인 상수 (status, mode): 영문 snake_case
- 사용자 보이는 라벨 (BloomLevel): 한글 표시값

### Repository 패턴

Repository는 모든 DB 접근을 캡슐화합니다.

```python
class ProjectEvaluationRepository:
    def __init__(self, session: Session):
        self.session = session
    
    def create(self, evaluation: ProjectEvaluationCreate) -> ProjectEvaluationRead:
        """새 평가 생성"""
        row = ProjectEvaluationRow(
            id=str(uuid4()),
            name=evaluation.name,
            status=EvaluationStatus.CREATED,
        )
        self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return ProjectEvaluationRead.model_validate(row)
    
    def get_by_id(self, evaluation_id: str) -> ProjectEvaluationRead | None:
        """ID로 평가 조회"""
        stmt = select(ProjectEvaluationRow).where(
            ProjectEvaluationRow.id == evaluation_id
        )
        row = self.session.scalar(stmt)
        return ProjectEvaluationRead.model_validate(row) if row else None
```

**원칙**:
- 모든 쿼리는 Repository 메서드로 감싼다
- 반환값은 Pydantic Read 모델 (ORM Row가 아님)
- IntegrityError, 기타 예외는 명시적으로 처리

### Service 계층

Service는 Repository와 설정에 의존하며 비즈니스 로직을 조율합니다.

```python
from app.project_evaluations.persistence.repository import (
    ProjectEvaluationRepository,
    ProjectArtifactRepository,
)
from app.project_evaluations.service import ProjectEvaluationService

class ProjectEvaluationService:
    def __init__(
        self,
        repo: ProjectEvaluationRepository,
        artifact_repo: ProjectArtifactRepository,
        llm_client: LlmClient,
        settings: AppSettings,
    ):
        self.repo = repo
        self.artifact_repo = artifact_repo
        self.llm_client = llm_client
        self.settings = settings
    
    async def run_quality_assessment(
        self, evaluation_id: str
    ) -> ProjectQualityAssessmentRead:
        """품질 평가 실행"""
        evaluation = self.repo.get_by_id(evaluation_id)
        if not evaluation:
            raise ValueError(f"Evaluation {evaluation_id} not found")
        
        # 품질 평가 로직
        ...
```

**원칙**:
- 모든 Repository를 `__init__`에서 의존성 주입 받음
- LLM, 외부 서비스도 service에서 관리
- 비즈니스 로직은 여기서, 쿼리는 repo에서

### 타입 어노테이션

**모든 함수 시그니처에 타입 명시**:

```python
async def create_evaluation(
    request: ProjectEvaluationCreate,
    session: Session = Depends(get_session),
) -> ProjectEvaluationRead:
    """새 평가 생성"""
    repo = ProjectEvaluationRepository(session)
    return await repo.create(request)

def normalize_bloom_level(level: str) -> BloomLevel:
    """Bloom 레벨 정규화"""
    try:
        return BloomLevel(level)
    except ValueError:
        raise ValueError(f"Unknown Bloom level: {level}")
```

### 에러 처리

**Silent fallback 금지** — 실패를 명시적으로 드러냅니다.

```python
# WRONG: 조용한 실패
try:
    context = build_project_context(artifacts)
except Exception:
    context = {}  # 이렇게 하지 마시오

# CORRECT: 실패 원인을 드러냄
try:
    context = build_project_context(artifacts)
except ValueError as e:
    # 응답에 오류 상태 반영 또는 로깅
    _logger.error(f"Failed to build context: {e}", exc_info=True)
    raise HTTPException(
        status_code=400,
        detail=f"Context build failed: {str(e)}"
    )
```

**원칙**:
- 빈 fallback 하지 말 것
- 스택 트레이스와 원인을 로깅
- API 응답에 상태 코드 + 명확한 에러 메시지

### 테스트

- **Framework**: pytest
- **명령**: `uv run pytest`
- **구성**: `pyproject.toml` 의 `[tool.pytest.ini_options]`

```python
import pytest
from app.project_evaluations.service import ProjectEvaluationService

@pytest.mark.asyncio
async def test_create_evaluation(mock_repo, mock_llm):
    service = ProjectEvaluationService(
        repo=mock_repo,
        llm_client=mock_llm,
    )
    result = await service.create_evaluation(...)
    assert result.id is not None
```

---

## 2. 프론트엔드 (Next.js / React / TypeScript)

### 버전 및 패키지 관리

- **Next.js 16** (App Router)
- **React 19**
- **pnpm 9.5.0+** (package manager)
- **Node 20+**

### TypeScript & 타입

**모든 컴포넌트와 Hook에 타입 명시**:

```typescript
interface ProjectCardProps {
  evaluation: ProjectEvaluationRead
  onSelect: (id: string) => void
}

function ProjectCard({ evaluation, onSelect }: ProjectCardProps) {
  return (
    <button onClick={() => onSelect(evaluation.id)}>
      {evaluation.name}
    </button>
  )
}
```

**API 응답 타입 자동생성**:
```bash
# backend의 /openapi.json 에서 TypeScript 타입 생성
pnpm openapi:gen
# 출력: src/lib/api/types.gen.ts
```

**타입 import 규칙**:
```typescript
// 서버 상태(백엔드 응답)
import type { ProjectEvaluationRead } from '@/lib/api/types.gen'

// 로컬 상태, Wizard 상태
export interface WizardInfoDraft {
  name: string
  project_category: ProjectCategory
}
```

### API 클라이언트 패턴

**apiFetch** 래퍼 사용 (`src/lib/api/client.ts`):

```typescript
import { apiFetch, ApiError } from '@/lib/api/client'

// 기본 GET
const evaluation = await apiFetch<ProjectEvaluationRead>(
  `/evaluations/${id}`
)

// POST with body
const created = await apiFetch<ProjectEvaluationRead>(
  '/evaluations',
  {
    method: 'POST',
    body: { name: 'My Project', category: 'capstone_final' },
  }
)

// Query string
const results = await apiFetch<EvaluationSummary[]>(
  '/evaluations',
  {
    query: { status: 'analyzed', limit: 10 },
  }
)

// 바이너리 응답 (TTS audio 등)
const audioResponse = await apiFetchRaw(
  `/interviews/${sessionId}/speak`,
  { raw: true }
)
```

**에러 처리**:
```typescript
try {
  await apiFetch(...)
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`API Error ${error.status}: ${error.message}`)
    // error.detail 에 FastAPI 원본 detail 포함
  }
}
```

**원칙**:
- Silent fallback 금지 (에러는 throw됨)
- `NEXT_PUBLIC_API_BASE_URL` (브라우저)
- `INTERNAL_API_BASE_URL` (SSR/Docker)
- `sessionId`, `sessionToken` 헤더 자동 추가 가능
- Binary 응답은 `raw: true` 옵션

### TanStack Query v5

서버 상태 관리:

```typescript
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api/client'

function useEvaluation(id: string) {
  return useQuery({
    queryKey: ['evaluations', id],
    queryFn: async () => apiFetch<ProjectEvaluationRead>(
      `/evaluations/${id}`
    ),
  })
}

function useCreateEvaluation() {
  return useMutation({
    mutationFn: async (payload: ProjectEvaluationCreate) =>
      apiFetch<ProjectEvaluationRead>('/evaluations', {
        method: 'POST',
        body: payload,
      }),
  })
}
```

### React Hook Form + Zod 검증

폼 검증:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const createEvaluationSchema = z.object({
  name: z.string().min(1, '평가 이름은 필수입니다'),
  category: z.enum(['weekly', 'midterm', 'final', 'capstone_final']),
  focus_points: z.string().optional(),
})

type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>

function CreateEvaluationForm() {
  const form = useForm<CreateEvaluationInput>({
    resolver: zodResolver(createEvaluationSchema),
  })

  return (
    <form onSubmit={form.handleSubmit(async (data) => {
      await apiFetch('/evaluations', { method: 'POST', body: data })
    })}>
      {/* 폼 필드 */}
    </form>
  )
}
```

### Wizard (다단계) 상태 관리

메모리 기반 상태 머신 (`src/lib/wizard/state.tsx`):

```typescript
export const WIZARD_STEP_TOTAL = 5
export type WizardStep = 1 | 2 | 3 | 4 | 5

export interface WizardInfoDraft {
  name: string
  project_category: ProjectCategory
  focus_points: string
}

export interface WizardPolicyDraft {
  total_question_count: number
  bloom_ratios: Record<string, number>
}

function useWizardState() {
  const [step, setStep] = useState<WizardStep>(1)
  const [info, setInfo] = useState<WizardInfoDraft>(...)
  const [policy, setPolicy] = useState<WizardPolicyDraft>(...)
  
  const advance = async () => {
    // 다음 단계로
  }
  
  return { step, info, policy, advance }
}
```

**원칙**:
- **메모리만 사용** (sessionStorage/localStorage 미사용)
- 새로고침 시 1단계부터 재시작
- `AdvanceConfig` 인터페이스로 각 단계의 진행 조건 관리

### shadcn/ui 컴포넌트

컴포넌트 라이브러리:

```typescript
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function MyComponent() {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <h2>Dialog Title</h2>
        </DialogHeader>
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">내용</TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
```

**설치**: `pnpm dlx shadcn-ui@latest add <component>`

### Tailwind CSS v4

스타일 정의 (`@tailwindcss/postcss`):

```typescript
function MyButton() {
  return (
    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
      Click me
    </button>
  )
}
```

### 차트 및 다이어그램

- **@nivo/bar**, **@nivo/radar**: 평가 리포트 시각화
- **@xyflow/react**: 아키텍처 흐름도

```typescript
import { BarChart } from '@nivo/bar'

function QuestionDistributionChart({ data }) {
  return (
    <BarChart
      data={data}
      keys={['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']}
      indexBy="category"
      height={400}
    />
  )
}
```

### Linting

```bash
pnpm lint
# ESLint 설정: .eslintrc (Next.js 기본)
```

### 타입 생성 및 빌드

```bash
# Backend OpenAPI 에서 타입 자동생성
pnpm openapi:gen

# 프로덕션 빌드
pnpm build

# 로컬 서버 실행
pnpm dev
```

---

## 3. 공통 규칙

### UI 텍스트 및 코드 언어

- **UI 텍스트**: 한국어
- **코드 (변수, 함수, Enum)**: 영문

```typescript
// 올바른 예
const projectName = "My Project"  // 영문 변수명
const message = "프로젝트를 생성했습니다"  // 한글 UI 텍스트

enum Status {
  CREATED = "created",  // 영문 ID
  REVIEWED = "reviewed",
}

const statusLabel = {
  created: "생성됨",  // 한글 표시값
  reviewed: "검토됨",
}
```

### 출처 참조 (Source Reference)

질문, 리포트, 분석 결과에는 **출처 참조를 포함**합니다.

```python
from pydantic import BaseModel

class SourceReference(BaseModel):
    artifact_id: str
    file_path: str
    file_type: str  # "code", "document", "api_spec" 등
    line_range: tuple[int, int] | None = None
    excerpt: str

class InterviewQuestionRead(BaseModel):
    text: str
    source_refs: list[SourceReference]  # 이 질문의 근거
```

**원칙**:
- 모든 질문은 artifact 근거 제시
- RAG 검색 결과와 함께 문서-코드 alignment 추적
- 리포트에 명시적 cite 포함

### 에러 처리 및 실패 추적

Silent fallback 금지 — 모든 실패를 API/UI에서 추적 가능하게:

```python
class EvaluationStatus(StrEnum):
    CREATED = "created"
    UPLOADED = "uploaded"
    ANALYZED = "analyzed"        # 성공
    # ... 중간 단계들
    REPORTED = "reported"        # 최종 성공

# 실패 상태도 명시적으로 기록
class ArtifactStatus(StrEnum):
    EXTRACTED = "extracted"      # 성공
    SKIPPED = "skipped"          # 스킵 (의도적 제외)
    FAILED = "failed"            # 실패 (근본 원인 필요)
```

**원칙**:
- 모든 비동기 작업(artifact extraction, LLM analysis, etc.)은 상태 전이로 추적
- 실패 시 근본 원인을 저장 (에러 메시지, 예외 스택)
- UI는 상태를 읽어 사용자에게 진행 상황 표시

### Docker & 로컬 개발

**Makefile 커맨드**:
```bash
make backend-dev      # FastAPI dev server (port 8000)
make frontend-dev     # Next.js dev server (port 3000)
make qdrant-up        # Qdrant vector DB (docker)
make qdrant-reset     # Qdrant 데이터 초기화
make frontend-types   # OpenAPI → TypeScript 타입 생성
```

**환경 변수**:

Backend (`.env`):
```
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
DATABASE_URL=sqlite:///./app.db
```

Frontend (`.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
INTERNAL_API_BASE_URL=http://api:8000  # Docker 내부
```

### 데이터베이스

- **SQLite3** (로컬 개발 및 MVP)
- **ORM**: SQLAlchemy 2.x
- **마이그레이션**: Alembic (필요시)

### 로깅

Python:
```python
import logging
_logger = logging.getLogger(__name__)
_logger.info("정보")
_logger.warning("경고")
_logger.error("에러", exc_info=True)
```

JavaScript/TypeScript:
```typescript
// console.log 금지, 대신 적절한 로깅 라이브러리 사용
import { toast } from 'sonner'
toast.error("작업 실패")
```

---

## 4. 요약 체크리스트

새 코드 작성 전:

**백엔드**:
- [ ] 타입 어노테이션 모든 함수 시그니처에 포함
- [ ] StrEnum 사용 (일반 Enum 아님)
- [ ] SQLAlchemy: `Mapped[T]` + `mapped_column()` 패턴
- [ ] Repository에 모든 DB 쿼리 캡슐화
- [ ] Silent fallback 금지 — 에러 명시적 처리
- [ ] 로깅: `logging` 모듈 (print/console.log 안 됨)

**프론트엔드**:
- [ ] TypeScript 타입 명시
- [ ] apiFetch<T>() 사용 (fetch 직접 금지)
- [ ] TanStack Query로 서버 상태 관리
- [ ] Zod 스키마로 폼 검증
- [ ] UI 텍스트 한국어, 변수명 영문
- [ ] console.log 금지, 에러는 throw하거나 toast 표시

**공통**:
- [ ] Source reference 포함
- [ ] 에러 상태를 명시적으로 추적
- [ ] Make 커맨드로 개발 환경 실행
