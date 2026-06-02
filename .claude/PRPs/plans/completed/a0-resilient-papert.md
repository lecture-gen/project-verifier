# Plan: A0 포스터 전면 재설계 — 우수작 기반 산문형 + mermaid 다이어그램

**대상**: `poster/react-poster/` (캡스톤 최종발표 2026-06-05용 세로 A0 포스터)
**복잡도**: Large (콘텐츠·다이어그램 엔진·레이아웃 동시 교체)
**제약**: Playwright 등 불필요 의존성 금지. 출력/검증은 **agent-browser**. mermaid는 사용자 승인하에 신규 도입, `@xyflow/react`는 제거.

## Context

기존 포스터는 (1) React Flow 다이어그램 4개가 모두 칸을 넘쳐 출력되고(fitView 컨테이너 측정 실패 + `overflow:visible !important`), (2) 내용이 카드/리스트 위주라 일반적 캡스톤 포스터 형식과 어긋난다. 사용자가 첨부한 **우수작 3편(17조 VeriVote, 19조 Abydos, 18조 NFC LockGuard)**의 공통 형식은 다음과 같다.

- 다크 네이비 헤더(번호/팀 배지 · 큰 영문 제목 · 한글 부제 · QR)
- **산문형 본문**(카드·불릿 나열이 아닌, 양쪽정렬 문단)
- **정적 아이콘 다이어그램 1~2개**(로고 박스 + 라벨 화살표 + 범례)
- 결과물 스크린샷 + 캡션
- 기대효과(2~3개 측면, 라벨 + 산문 한 문장)
- 회색 푸터(지도교수 · 팀원 역할 · 주요 적용 기술 및 구조)

목표: 이 형식을 따라 **콘텐츠를 처음부터 새로 작성**(실제 코드/문서에서 검증한 사실 기반, 과장 없음)하고, React Flow를 **mermaid(SVG)**로 교체해 칸 넘침을 근본 제거하며, 검증된 고정 캔버스·WYSIWYG·고해상도 export 인프라는 유지한다.

### 사용자 확정 결정
1. 다이어그램 엔진 → **mermaid 전환**, React Flow 풍 커스텀 CSS 미감 적용
2. 다이어그램 **2개**: 시스템 구조 + 처리 흐름
3. Bloom's Taxonomy → **산문에서만 언급**(전용 도식 없음)
4. 콘텐츠 → 기존 카피 폐기, **프로젝트를 직접 파악해 새로 작성**

## 유지할 자산 (재사용)
| 자산 | 위치 | 유지 이유 |
|---|---|---|
| 고정 캔버스 1400×1979px | `src/poster.css` `.poster` | A0 비율, WYSIWYG 기반 |
| 균일 스케일 인쇄 | `src/poster.css` `@media print { transform: scale(2.2698) }` | reflow 없는 벡터 확대 |
| 고해상도 export·검증 절차 | `README.md` | agent-browser PNG(dsf4) + Chrome PDF |
| 디자인 토큰 | `src/poster.css :root`(navy/accent…) | 네이비 학술 톤(우수작과 동일 계열) |

## 제거
- `src/diagrams/{ArchitectureDiagram,FlowDiagram,AIFlowDiagram,BloomDiagram}.tsx`, `src/diagrams/nodes/*` (React Flow)
- `package.json`에서 `@xyflow/react` 제거, `mermaid` + `@iconify-json/logos`(로컬 아이콘) 추가

## 검증된 사실 (콘텐츠 근거 — 코드/문서 교차확인)
- **5단계 LLM 에이전트 체인**(모두 gpt-4o-mini 단일 호출): Context Builder → Quality Assessor → Question Generator → Judge(Evaluator) → Report Generator. (`backend/app/project_evaluations/{analysis,interview,reports}/*.py`)
- **꼬리질문 분기**: Judge가 `needs_follow_up` 판정, `target_rubric_index`로 미점검 기준만 추가 질문. (`interview/evaluator.py`, `turn_flow.py`)
- **RAG**: file_classifier(10 역할) → 추출(pypdf/python-pptx/python-docx) → splitters(Python AST 심볼·정규식·markdown 섹션·manifest) → redaction(sk-/AKIA/JWT) → embedder `text-embedding-3-small`(1536) → Qdrant `project_evaluation_chunks`(COSINE, top_k=5) → context pack(6 자동 쿼리·다양성 필터). (`ingestion/*`, `rag/*`)
- **Bloom 6단계**(기억·이해·적용·분석·평가·창안) 정책 기반 질문 배분(기본 각 1개=6문항), **문제별 동적 루브릭**(LLM 생성, 항목별 points). (`interview/question_generator.py`)
- **음성**: STT `gpt-4o-transcribe`(ko), TTS `gpt-4o-mini-tts`(voice=coral). (`interview/speech_service.py`)
- **상태머신**: Evaluation `CREATED→UPLOADED→ANALYZED→QUESTIONS_GENERATED→INTERVIEWING→REPORTED`. **동기 처리 + DB 폴링**(async 큐 미구현 — 과장 금지). (`domain/enums.py`)
- **출력**: 최종 판정(검증 통과/추가 확인 필요/신뢰 낮음), authenticity_score(0~100 정규화), 영역별 신뢰도, Bloom 도달도, 강점/보완. (`reports/report_generator.py`)
- **기술 스택(정확)**: Backend FastAPI≥0.128·Pydantic 2.12·SQLAlchemy 2.0·SQLite·Python 3.13 / Frontend Next.js 16.2·React 19.2·Tailwind 4·TanStack Query 5·shadcn·Nivo / Vector Qdrant 1.15 / Infra Docker Compose(api·web·qdrant)·uv·pnpm.
- **팀**: 이강혁(팀장·백엔드·인프라), 신준성(프론트엔드), 황현석(AI). 지도교수 **지준 교수님**. 한성대 지능시스템 캡스톤디자인. 발표 2026-06-05.
- ⚠️ **정량 효과 수치 근거 없음** → "67% 절감" 등 삭제, 기대효과는 정성 서술.

## 레이아웃 — 확정: C. 좌우 2단 에디토리얼 (19조 Abydos 스타일, 세로 A0)

```
┌──────────────────────────────────────────────┐
│ HEADER (네이비)  Dialearn / 부제 / Team·교수 / QR │
├───────────────────────┬──────────────────────┤
│ ● 작품 개요            │ ● 시스템 구조           │
│ (산문 한 문단)          │ [mermaid architecture] │
│                       │   + 기술 배지           │
│ ● 주요 기능            ├──────────────────────┤
│ · RAG 자료 분석        │ ● 동작 원리             │
│ · Bloom 유형별 출제     │ (산문 intro)            │
│ · 루브릭 기반 꼬리질문   │ [mermaid flowchart]    │
│ · 다중 에이전트 리포트   ├──────────────────────┤
│                       │ ● 결과물 (3장 세로)      │
│                       │  ① 교수자 평가 개요      │
│                       │  ② 학생 평가 진행        │
│                       │  ③ 학생 리포트          │
├───────────────────────┴──────────────────────┤
│ 기대효과 ① 진위검증 자동화 ② 근거기반 객관평가 ③ 영역별 진단 │
├──────────────────────────────────────────────┤
│ FOOTER (회색)  지도교수·팀원 역할 │ 주요 적용 기술 및 구조 │
└──────────────────────────────────────────────┘
```

- 본문은 **좌우 2단 영구 분할**. 좌단: 작품 개요 + 주요 기능(▪ 4개 산문). 우단: 시스템 구조 + 동작 원리 + 결과물 3장. 기대효과는 2단 아래 전폭 띠. 푸터 전폭.
- 세로 분배는 flex 원칙 유지: 산문 행 `flex:0 0 auto`, 두 다이어그램 블록이 각 단의 잔여 공간 흡수(`flex:1`). mermaid SVG는 `width:100%;height:100%` + `preserveAspectRatio`로 채워 fitView 같은 측정 의존이 없어 **칸 넘침이 발생하지 않는다**.
- 두 단의 높이 균형: 좌단 산문 분량과 우단(다이어그램2+스크린샷3) 높이를 맞추도록 폰트·여백 패스로 조정.

## 작성 원칙 (본문 톤)
- 불릿·리스트로 나열하지 않는다. 모든 본문은 **문단(산문)**으로 쓴다.
- 소제목과 본문은 **줄바꿈으로 분리**한다. `소제목 — 본문`처럼 em-dash로 한 줄에 붙이지 않는다. (소제목은 한 줄, 그 아래 줄부터 본문 문단)
- 사람이 쓴 듯 자연스럽고 충분한 분량으로 쓴다. 지나친 축약·키워드 나열·기계적 어투를 피한다.

## 새 산문 카피 (구현 시 이대로 작성 — 검토용 초안)

**작품 개요**
> 생성형 AI의 급격한 발전으로, 학생들이 코드와 문서를 AI의 힘을 빌려 손쉽게 만들어낼 수 있게 되었다. 그 결과 학생이 제출한 결과물을 본인이 실제로 이해하고 수행했는지 확인하는 일이 평가자의 핵심 과제로 떠올랐다. 제출된 코드와 문서만으로는 학생이 구조와 설계 의도를 진짜로 이해했는지, 혹은 상당 부분을 AI나 타인에게 맡긴 것은 아닌지 판별하기 어렵다. **Dialearn**은 학생이 업로드한 프로젝트 자료(ZIP 또는 GitHub 저장소)를 AI가 직접 분석하고, 그 자료에 근거한 질문으로 인터뷰를 진행하여 답변과 제출물의 일치도를 추적한다. 이로써 *"이 학생이 이 프로젝트를 진짜로 수행했는가"* 라는 질문에, 영역별 신뢰도와 근거가 담긴 리포트로 답한다.

**시스템 구조 (intro)**
> 브라우저의 Next.js 웹이 FastAPI 백엔드와 통신하고, 백엔드는 제출 자료를 RAG 파이프라인으로 색인한 뒤 다섯 단계의 LLM 에이전트로 분석·출제·채점·리포트를 수행한다. 자료 임베딩은 Qdrant 벡터 DB에, 모든 LLM·음성 호출은 OpenAI API에 라우팅된다.

**동작 원리 (intro)**
> 평가자가 자료를 올리면 시스템이 프로젝트 컨텍스트와 품질을 분석하고, 자료 근거에 기반해 Bloom 인지 6단계에 걸친 질문과 채점 루브릭을 생성한다. 학생은 텍스트 또는 음성으로 답하며, 채점 에이전트가 답변마다 루브릭으로 채점하고 근거가 부족하면 꼬리질문으로 더 파고든다. 모든 턴이 끝나면 영역별 신뢰도와 도달도를 담은 검증 리포트가 생성된다.

**주요 기능** (소제목은 한 줄, 본문은 그 아래 문단 — em-dash 인라인 금지)

> **RAG 자료 분석**
> 학생이 제출한 ZIP이나 GitHub 저장소에는 보통 수십 개의 코드 파일과 보고서, 발표자료가 뒤섞여 있다. Dialearn은 이 자료들을 먼저 역할별로 분류한 뒤, 코드는 구문 트리(AST)를 이용해 함수와 클래스 단위로, 문서는 제목과 섹션 단위로 잘게 나눈다. 이 과정에서 소스에 섞여 있을 수 있는 API 키나 비밀번호 같은 민감정보는 자동으로 가려진다. 정리된 조각들은 벡터로 변환되어 Qdrant에 저장되고, 이후 질문을 만들 때마다 그 프로젝트에서 실제 근거가 되는 부분을 찾아 함께 활용한다. 덕분에 모든 질문은 일반론이 아니라 바로 그 학생의 코드와 문서에 뿌리를 둔다.
>
> **Bloom 유형별 출제**
> 제대로 된 검증은 "무엇을 썼는가"를 넘어 "왜 그렇게 했고 어떻게 동작하는가"까지 물어야 한다. Dialearn은 Bloom의 인지 6단계, 곧 기억에서 이해와 적용을 거쳐 분석, 평가, 창안으로 이어지는 유형에 맞춰 질문을 고르게 배분하고, 질문마다 좋은 답을 가려낼 채점 기준을 함께 마련한다. 그래서 단순 암기부터 설계 판단까지, 학생의 이해를 여러 층위에서 짚어 볼 수 있다.
>
> **루브릭 기반 꼬리질문**
> 채점은 질문마다 미리 정해 둔 여러 루브릭 기준으로 이루어진다. 학생의 답변이 그중 일부 기준을 충족하지 못하면, Dialearn은 아직 확인되지 않은 바로 그 기준을 겨냥해 꼬리질문을 만들어 다시 묻는다. 이미 확인된 부분은 되묻지 않고 학생이 놓친 지점만 파고들기 때문에, 제한된 질문 수 안에서도 이해의 빈틈을 효율적으로 메운다.
>
> **다중 에이전트 채점과 리포트**
> 컨텍스트 분석, 품질 평가, 질문 생성, 답변 채점, 리포트 작성을 맡은 다섯 개의 AI 에이전트가 차례로 협력한다. 마지막 단계에서는 모든 답변을 종합해 기술 영역별 신뢰도와 Bloom 단계별 도달 정도를 산출하고, 어디서 이해가 충분했고 어디가 부족했는지를 강점과 보완점으로 정리한 검증 리포트를 자동으로 만들어 낸다.

**기대효과** (정성 서술 — 정량 수치 근거 없음. 소제목 한 줄 + 본문 문단)

> **진위 검증의 자동화**
> 교수자가 학생을 한 명씩 직접 면담하던 과정을 AI가 대신 수행한다. 출제와 채점이 자동으로 이루어지므로, 평가자는 면담을 진행하는 부담을 덜고 결과 리포트를 검토하고 판단하는 일에 집중할 수 있다.
>
> **근거에 기반한 객관적 평가**
> 모든 질문이 학생이 제출한 자료에서 출발하고 동일한 기준으로 채점된다. 평가자에 따라 질문의 깊이나 잣대가 달라지던 문제를 줄여, 여러 학생에게 일관된 기준을 적용할 수 있다.
>
> **영역별로 들여다보는 이해도**
> 하나의 점수로 뭉뚱그리는 대신 백엔드와 프론트엔드, AI처럼 기술 영역을 나누어 각각의 신뢰도와 이해 수준을 보여 준다. 이를 통해 학생이 프로젝트의 어느 부분을 실제로 소화했고 어디가 약한지를 구체적으로 드러낸다.

**푸터**
> 지도교수: 지준 교수님 · 이강혁(팀장) 백엔드·인프라 · 신준성 프론트엔드 · 황현석 AI
> 주요 적용 기술 및 구조 — 개발 환경: Docker Compose(api·web·qdrant), uv, pnpm / 언어: Python 3.13, TypeScript / 백엔드: FastAPI, SQLAlchemy 2, Pydantic v2, SQLite / 프론트·AI: Next.js 16, React 19, OpenAI(gpt-4o-mini), Qdrant(text-embedding-3-small), STT·TTS(gpt-4o-transcribe·gpt-4o-mini-tts)

## mermaid 다이어그램 설계

**공통**: `mermaid.initialize({ startOnLoad:false, theme:'base', themeVariables:{ fontFamily, primaryColor, primaryBorderColor, lineColor, … } })` + 외부 CSS(`themeCSS` 또는 전역 `.mermaid svg .node rect` 규칙)로 네이비·라운드·그림자(React Flow 풍) 적용. `flowchart:{ useMaxWidth:false }`. 아이콘은 `@iconify-json/logos`를 로컬 import 후 `registerIconPacks`(네트워크 의존 0).

**다이어그램 1 — 시스템 구조 (architecture-beta)**: 그룹 `사용자/Dialearn/외부 API`, 서비스 박스(브라우저·Next.js·FastAPI·SQLite·Qdrant·OpenAI)에 logos 아이콘, 라벨 엣지. (아이콘명은 구현 시 `@iconify-json/logos`에 실존하는지 확인 후 대체)

**다이어그램 2 — 처리 흐름 (flowchart LR + classDef)**: subgraph `교수자 / AI 분석·출제 / 학생 인터뷰` + 리포트. 핵심 엣지: `업로드 → RAG색인 → 컨텍스트·품질 → Bloom질문생성 → 답변 → {채점: 부족→꼬리질문 루프 / 충분→리포트}`. classDef로 RAG/에이전트/음성/판정 색 구분.

## Files to Change
| File | Action | Why |
|---|---|---|
| `package.json` | UPDATE | `@xyflow/react` 제거, `mermaid`·`@iconify-json/logos` 추가 |
| `src/components/Mermaid.tsx` | CREATE | `mermaid.render(id, def)` → SVG 주입 컴포넌트(렌더 완료 플래그 노출) |
| `src/diagrams/architecture.ts` | CREATE | 시스템 구조 mermaid 정의 + 테마 |
| `src/diagrams/flow.ts` | CREATE | 처리 흐름 mermaid 정의 + classDef |
| `src/diagrams/{Architecture,Flow,AIFlow,Bloom}Diagram.tsx`, `src/diagrams/nodes/*` | DELETE | React Flow 제거 |
| `src/App.tsx` | REWRITE | 우수작 미러 산문 레이아웃 + `<Mermaid>` 2개 + 결과물/기대효과/푸터 |
| `src/poster.css` | REWRITE(부분) | 산문 타이포(양쪽정렬·문단)·섹션 바·헤더/푸터 밴드·mermaid SVG 스타일·결과물 그리드; 캔버스/print/토큰은 유지 |
| `src/main.tsx` | UPDATE | `mermaid.initialize` + `registerIconPacks` 1회 부트스트랩 |
| `public/screenshots/*` | ADD | 인터뷰·리포트 화면 신규 캡처(아래 Task 6) |
| `README.md` | UPDATE | React Flow→mermaid 반영, export/검증 절차 유지 |

## Tasks

### Task 1: 의존성 교체 + mermaid 부트스트랩
- `@xyflow/react` 제거, `mermaid`·`@iconify-json/logos` 추가(`yarn`). `main.tsx`에서 `mermaid.initialize`(theme base + themeVariables) + `registerIconPacks(logos)` 1회.
- **Validate**: `yarn dev` 부팅, 콘솔 에러 0.

### Task 2: `<Mermaid>` 컴포넌트 (칸 넘침 근본 해결)
- props `def:string` 받아 `useLayoutEffect`에서 `await mermaid.render(uid, def)` → `innerHTML` 주입. SVG에 `width:100%;height:100%`. 전체 다이어그램 렌더 완료 시 `window.__diagramsReady=true` 세팅(캡처 동기화용).
- **Mirror**: 기존 `.rf-fill` 잔여높이 흡수 패턴을 SVG 컨테이너에 적용.
- **Validate**: 두 다이어그램이 블록 경계 안에서 잘림/넘침 없이 렌더(agent-browser 캡처).

### Task 3: 두 mermaid 정의 작성 + React Flow 풍 스타일
- `architecture.ts`(architecture-beta), `flow.ts`(flowchart LR + classDef). 네이비 팔레트·라운드·엣지 라벨. 아이콘명 실존 확인.
- **Validate**: 우수작 톤과 비교, 라벨 가독성·아이콘 정상 표시.

### Task 4: `App.tsx` 산문 레이아웃 전면 재작성
- 위 "새 산문 카피" 그대로 반영. 카드/리스트 컴포넌트(`ProblemItem/FeatureCard/ScenarioItem/BloomExample/ReportBar/비교표/67%`) 전부 제거. 헤더(제목·부제·팀·QR), 작품개요, 시스템구조(+기술배지), 동작원리, 주요기능(▪4), 결과물, 기대효과(3), 푸터.
- **Validate**: 카드 0개, 본문이 문단형, 섹션 누락 없음.

### Task 5: `poster.css` 산문 타이포 + 밴드 + mermaid 스타일
- 양쪽정렬 문단(`p{ text-align:justify; line-height:1.55 }`), 섹션 제목 바(네이비), 헤더/푸터 밴드, 결과물 그리드, `.mermaid svg` 규칙. 캔버스(1400×1979)·`@media print scale`·`:root` 토큰은 보존. 세로 flex 분배로 캔버스 정확히 채움(여백 0).
- **Validate**: `posterScrollH==1979`, footer 위 여백 0, 잘림 0(agent-browser eval).

### Task 6: 결과물 스크린샷 — 정확히 3개 (사용자 확정)
- 결과물 섹션에 다음 **3개 화면**만 넣는다(워크플로우 순서: 교수자 → 학생 진행 → 학생 결과).
  1. **교수자 — 평가 개요 화면** (관리 콘솔 개요 탭): 기존 `04_admin_console.png` 활용 가능. 캡션 예: "교수자 — 평가 개요/관리 콘솔".
  2. **학생 — 평가 진행 화면** (인터뷰 세션): repo에 **없음** → 신규 캡처 필요.
  3. **학생 — 평가 후 리포트 화면** (리포트): repo에 **없음** → 신규 캡처 필요.
- 신규 캡처 절차: 백엔드/프론트 dev 기동 → 시드 평가/세션 생성 → agent-browser로 인터뷰 진행 화면·리포트 화면 캡처 → `public/screenshots/`에 저장(예: `interview_session.png`, `report.png`). 캡처 시 데모용 더미 데이터 사용 가능.
- **Validate**: 결과물에 정확히 3개 화면 + 한글 캡션, 잘림 없이 표시.

### Task 7: WYSIWYG export·검증 + README 갱신
- agent-browser: `set viewport 1400 1979 4` → `eval`로 `__diagramsReady`/폰트(`document.fonts.ready`) 대기 → `screenshot poster-A0.png`(5600×7916). Chrome Cmd+P A0 PDF는 벡터(텍스트+mermaid SVG) 경로로 유지. README를 mermaid 기준으로 갱신.
- **Validate**: 화면 캡처 vs 인쇄 미리보기 레이아웃·줄바꿈·다이어그램 위치 일치.

## Validation
```bash
cd poster/react-poster
yarn install            # @xyflow/react 제거, mermaid·@iconify-json/logos 추가
yarn dev                # http://localhost:5173
yarn build              # 타입체크 + 번들 (mermaid 동적 import 확인)
# agent-browser
agent-browser open http://localhost:5173
agent-browser set viewport 1400 1979 4
agent-browser eval "(async()=>{await document.fonts.ready; return window.__diagramsReady===true})()"
agent-browser screenshot poster-A0.png
agent-browser eval "(()=>{const p=document.querySelector('.poster');const b=document.querySelector('.body-wrap');return JSON.stringify({posterScrollH:p.scrollHeight,bodyH:b.offsetHeight,bodyScrollH:b.scrollHeight})})()"
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| architecture-beta(beta) 아이콘명·스타일 한계 | Medium | 아이콘 실존 확인, 부족하면 flowchart+FontAwesome/이미지로 대체 |
| mermaid 자동 레이아웃이 의도와 다른 배치 | Medium | 방향(LR/TB)·subgraph·링크 구조로 유도, 노드 수 최소화 |
| async render 미완료 상태로 캡처 | Medium | `__diagramsReady` 플래그 + agent-browser eval 대기 |
| 산문 전환으로 세로 공간 과부족 | Medium | flex 분배 + 다이어그램 블록이 slack 흡수, 폰트/여백 패스 |
| 인터뷰·리포트 화면 캡처 불가(LLM 시간/시드) | Medium | 기존 스크린샷으로 대체, 캡션으로 맥락 보강 |

## Acceptance
- [ ] 카드/리스트 폐기, 우수작형 **산문 본문**으로 전환
- [ ] 다이어그램 2개(시스템 구조·처리 흐름)가 **칸 넘침 없이** 블록 안에 렌더(mermaid SVG)
- [ ] React Flow 의존 제거, mermaid 도입, Playwright 미설치
- [ ] 콘텐츠가 **코드/문서 검증 사실** 기반(과장·허위 수치 없음)
- [ ] 헤더·개요·구조·원리·기능·결과물·기대효과·푸터 구성, 세로 A0 캔버스 꽉 참
- [ ] 화면=인쇄(PNG/PDF) WYSIWYG 일치
