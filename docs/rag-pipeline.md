# RAG 파이프라인

**최종 업데이트:** 2026-05-27

Dialearn 프로젝트 평가 시스템의 RAG(Retrieval-Augmented Generation) 파이프라인. 학생이 업로드한 프로젝트 zip 파일에서 자료를 추출하여 벡터 검색 가능한 형태로 인덱싱하고, 질문 생성 시 문서와 코드 근거를 함께 검색해 제시하는 프로세스를 설명한다.

## 개요

RAG 파이프라인은 다음 단계로 구성된다:

1. **파일 분류** — zip 내부 파일을 artifact role로 분류
2. **텍스트 추출** — 문서(PDF, PPTX, DOCX) 및 코드, 텍스트 파일에서 내용 추출
3. **청킹(Chunking)** — 파일 종류별 전략으로 텍스트를 의미 있는 조각으로 분할
4. **임베딩** — OpenAI Embeddings API로 각 청크를 벡터로 변환
5. **Qdrant 저장** — 벡터와 메타데이터를 Qdrant에 저장
6. **검색** — 쿼리 임베딩을 기반으로 유사 청크 검색
7. **Context Pack 생성** — 검색 결과로 질문 생성용 문맥 패키지 조합

---

## 1. ArtifactRole 분류 체계

프로젝트 자료를 역할에 따라 10가지로 분류한다. 각 역할은 다른 chunking 전략과 메타데이터 정책을 받는다.

| Role | 한국어 | 설명 | 검색 대상 |
|------|--------|------|----------|
| `codebase_source` | 소스 코드 | 프로젝트 주요 구현 코드 | ✓ 질문 생성 |
| `codebase_test` | 테스트 코드 | 단위/통합/E2E 테스트 | ✓ 질문 생성 |
| `codebase_config` | 설정/의존성 | package.json, requirements.txt, docker-compose.yml 등 | ✓ 질문 생성 |
| `codebase_api_spec` | API 명세 | OpenAPI, Swagger, api.yaml 등 | ✓ 질문 생성 |
| `codebase_overview` | 프로젝트 개요 | README.md, CLAUDE.md | ✓ 질문 생성 |
| `project_report` | 프로젝트 보고서 | PDF 문서 | ✓ 질문 생성 |
| `project_presentation` | 발표자료 | PPTX 슬라이드 | ✓ 질문 생성 |
| `project_design_doc` | 설계 문서 | DOCX 설계서 | ✓ 질문 생성 |
| `project_description` | 프로젝트 설명 | .md, .txt 문서 | ✓ 질문 생성 |
| `ignored` | 무시됨 | 지원하지 않는 파일 | ✗ 제외 |

---

## 2. 파일 분류 로직

**파일:** `/backend/app/project_evaluations/ingestion/file_classifier.py`

### 분류 규칙 우선순위

1. **경로 무시** — `.git`, `node_modules`, `__pycache__`, `build`, `dist`, `target`, `vendor` 등 포함
2. **확장자 무시** — `.avi`, `.jpg`, `.gif`, `.mp3`, `.mp4`, `.png`, `.pyc`, `.so`, `.dll` 등
3. **파일명 패턴**
   - `readme.md`, `claude.md` → `codebase_overview`
   - `api.yaml`, `openapi.json`, `swagger.yml` → `codebase_api_spec`
   - `package.json`, `requirements.txt`, `pyproject.toml`, `docker-compose.yml` 등 → `codebase_config`
4. **문서 확장자**
   - `.pdf` → `project_report`
   - `.pptx` → `project_presentation`
   - `.docx` → `project_design_doc`
   - `.md`, `.txt` → `project_description`
5. **코드 확장자** (`.py`, `.js`, `.ts`, `.tsx`, `.java`, `.go`, `.rs`, `.c`, `.cpp`, `.json`, `.yaml` 등)
   - 경로에 `test`, `tests`, `spec`, `specs`, `__tests__` 포함 → `codebase_test`
   - 파일명이 `test_*`, `*_test`, `*.test.js`, `*.spec.ts` 등 → `codebase_test`
   - 그 외 → `codebase_source`

### 지원되는 확장자

**문서:** `.md`, `.txt`, `.pdf`, `.docx`, `.pptx`

**코드:** `.py`, `.js`, `.ts`, `.tsx`, `.jsx`, `.java`, `.kt`, `.go`, `.rs`, `.c`, `.cpp`, `.h`, `.hpp`, `.html`, `.css`, `.scss`, `.json`, `.yaml`, `.yml`, `.toml`, `.sql`

### Path Traversal 방지

- `is_safe_zip_member()`: zip 내 파일 경로가 절대 경로, `..` 포함, `\x00` 바이트 포함이 아닌지 검증
- `safe_target_path()`: 추출 대상 경로가 extract_dir 내에 있는지 resolve 후 확인

---

## 3. 텍스트 추출

**파일:** `/backend/app/project_evaluations/ingestion/text_extractors.py`

각 파일 형식별 추출 전략:

### PDF (`extract_pdf_text`)
- **라이브러리:** `pypdf.PdfReader`
- **제한:** `APP_MAX_PDF_PAGES` (기본값: 30페이지)
- **형식:** `[page N]\n<extracted_text>`로 페이지 마크업 포함
- **결과 제한:** 총 `APP_MAX_EXTRACTED_TEXT_CHARS` (기본값: 500,000자) 이내

### PPTX (`extract_pptx_text`)
- **라이브러리:** `python-pptx`
- **제한:** `APP_MAX_PPTX_SLIDES` (기본값: 80슬라이드)
- **형식:** `[slide N]\n<shape_text_lines>`로 슬라이드 마크업 포함
- **결과 제한:** 총 500,000자 이내

### DOCX (`extract_docx_text`)
- **라이브러리:** `python-docx`
- **제한:** `APP_MAX_DOCX_PARAGRAPHS` (기본값: 2,000단락)
- **형식:** 각 단락을 줄바꿈으로 구분
- **결과 제한:** 총 500,000자 이내

### 평문 파일 (`.txt`, `.json`, `.yaml`, `.csv` 등)
- 바이너리 감지: 처음 2,048바이트에 `\x00` 포함 여부 확인
- 포함 시 → 공문자열 반환 (바이너리 파일 취급)
- 미포함 시 → UTF-8 디코딩 (에러 무시 모드)

### 파일 크기 제한

| 제한 항목 | 기본값 | 설정 |
|----------|--------|------|
| 단일 파일 | 10 MB | `APP_MAX_TEXT_FILE_MB` |
| 추출 크기 제한 | 500,000자 | `APP_MAX_EXTRACTED_TEXT_CHARS` |

---

## 4. Zip 처리 및 안전장치

**파일:** `/backend/app/project_evaluations/ingestion/zip_handler.py`

### 업로드 제한

| 항목 | 기본값 | 설정 |
|------|--------|------|
| Zip 파일 최대 크기 | 50 MB | `APP_MAX_UPLOAD_MB` |
| 압축 해제 총 크기 | 150 MB | `APP_MAX_EXTRACTED_MB` |
| Zip 내부 파일 개수 | 2,000개 | `APP_MAX_ZIP_MEMBERS` |
| 처리할 파일 한도 | 1,000개 | `APP_MAX_PROCESSED_FILES` |

### 처리 흐름

1. Zip 파일 유효성 확인 (`BadZipFile` 예외 처리)
2. 멤버 목록 순회
3. 각 멤버마다:
   - 경로 안전성 검증
   - 분류 수행
   - 무시 대상이 아닌 경우 텍스트 추출
4. 파일 크기 초과 시 → `SKIPPED` 상태
5. 추출 실패 시 → `FAILED` 상태 (에러 타입 기록)
6. 추출 성공 → `EXTRACTED` 상태

### 결과 상태

| 상태 | 의미 |
|------|------|
| `EXTRACTED` | 성공적으로 추출됨 |
| `SKIPPED` | 무시되거나 크기 초과 |
| `FAILED` | 추출 중 오류 발생 |

---

## 5. Chunking 전략

**파일:** `/backend/app/project_evaluations/rag/splitters.py`

각 artifact role에 맞는 청킹 전략을 적용한다. 청크 크기 목표: **1,600자**, 중복: **180자**.

### 코드 파일 (`codebase_source`, `codebase_test`)

**2단계 청킹:**

1. **File Manifest** (항상 생성, chunk_type: `file_manifest`)
   - 파일명, artifact_role, 언어, 최상위 레벨 symbol 목록
   - 벡터 검색 시 파일 범위를 제한하기 위한 메타데이터 역할

2. **Symbol 추출** (chunk_type: `code_symbol`)
   - **Python 파일:** AST 파싱으로 top-level class/function/async function 추출
   - **기타 언어:** 정규식 패턴으로 `function`, `class`, `interface`, `type`, `const` 등 추출
   - Symbol 추출 실패 시 → 원문 청크 폴백

3. **원문 청크** (chunk_type: `code_raw`)
   - Symbol 청크가 없으면 원문을 재귀 분할
   - 분할점: 단락(`\n\n`), 줄(`\n`), 문장(`. `), 단어(` `) 우선순위로 탐색

### 설정/API 명세 (`codebase_config`, `codebase_api_spec`)

**구조적 분할:**

- **JSON 파일:** 최상위 key 단위로 청크 분할 (chunk_type: `structured_config`)
- **기타:** Markdown 분할 폴백 (chunk_type: `structured_config`)

### 프로젝트 개요 (`codebase_overview`)

**Markdown 분할 (chunk_type: `codebase_overview`)**

- 제목(`#`, `##`, `###` 등)으로 섹션 단위 분할
- 섹션 내용을 재귀 분할
- 제목 정보 유지: `section_title` 메타데이터

### 프로젝트 문서

**3가지 경우:**

#### 1. 마크된 문서 (PDF/PPTX/DOCX)
- PDF: `[page N]` 마크 감지
- PPTX: `[slide N]` 마크 감지
- 마크별로 섹션 분할, 각 섹션을 재귀 분할
- Metadata: `page_number` 또는 `slide_number`

#### 2. Markdown/텍스트 문서
- 제목으로 섹션 분할
- 섹션별 재귀 분할 (chunk_type: `project_document_semantic`)
- Metadata: `section_title`

#### 3. 폴백
- 제목이나 마크가 없으면 원문 재귀 분할 (chunk_type: `project_document_semantic`)

### 청크 레코드 (ChunkRecord)

**파일:** `/backend/app/project_evaluations/rag/chunk_models.py`

```python
@dataclass(frozen=True)
class ChunkRecord:
    # 핵심 필드
    text: str                    # 청크 내용
    evaluation_id: str           # 평가 ID
    artifact_id: str             # 문서 ID
    source_path: str             # zip 내 원본 경로
    source_type: str             # "code", "document", "text", "ignored"
    artifact_role: str           # ArtifactRole 값
    chunk_type: ChunkType        # file_manifest, code_symbol, project_document 등
    chunk_index: int             # 파일 내 청크 순서
    content_hash: str            # SHA256 해시
    
    # 선택적 메타데이터
    language: str | None         # python, javascript, typescript 등
    top_dir: str | None          # 경로의 첫 디렉터리
    project_area: str | None     # apps/*/src, services/*, src/* 형태 프로젝트 영역
    symbol_name: str | None      # 함수/클래스 이름
    symbol_type: str | None      # function, class, symbol
    line_start: int | None       # 시작 행 번호
    line_end: int | None         # 종료 행 번호
    char_start: int | None       # 시작 문자 위치
    char_end: int | None         # 종료 문자 위치
    page_number: int | None      # PDF 페이지 번호
    slide_number: int | None     # PPTX 슬라이드 번호
    section_title: str | None    # Markdown 섹션 제목
```

---

## 6. 임베딩 및 Qdrant 저장

**파일:** `/backend/app/project_evaluations/rag/embedder.py`

### 임베딩 모델

| 설정 | 기본값 | 용도 |
|------|--------|------|
| 임베딩 모델 | `text-embedding-3-small` | 벡터 생성 (1536 차원) |
| 벡터 차원 | 1,536 | Qdrant 저장소 구성 |

**모델 선택:**
- `text-embedding-3-small`: 1,536 차원 (기본)
- `text-embedding-3-large`: 3,072 차원 (고정밀)

### Qdrant 컬렉션

**컬렉션명:** `project_evaluation_chunks` (설정: `QDRANT_COLLECTION_NAME`)

**생성 정책:**
- 컬렉션 미존재 시 자동 생성
- 벡터 거리: COSINE
- 벡터 크기: 임베딩 모델에 따라 결정

**모델 변경 시 주의:**
`OPENAI_EMBEDDING_MODEL`을 바꾼 경우 벡터 크기가 맞지 않으면 컬렉션 재생성 필요.

### Payload 구조

Qdrant에 저장되는 메타데이터 (ChunkRecord의 `payload()` 메서드):

```json
{
  "text": "청크 내용",
  "evaluation_id": "평가-id",
  "artifact_id": "문서-id",
  "source_path": "zip/path/to/file.py",
  "source_type": "code",
  "artifact_role": "codebase_source",
  "chunk_type": "code_symbol",
  "chunk_index": 2,
  "content_hash": "sha256hash...",
  "language": "python",
  "top_dir": "src",
  "project_area": "src/app",
  "symbol_name": "MyClass",
  "symbol_type": "class",
  "line_start": 10,
  "line_end": 42,
  "char_start": 245,
  "char_end": 1203,
  "page_number": null,
  "slide_number": null,
  "section_title": null,
  "ingest_version": "uuid-for-versioning"
}
```

### 수집 흐름 (ingest_evaluation)

1. **청크 생성:** 모든 artifact에서 청크 추출
2. **민감정보 제거:** 각 청크 텍스트에 `redact_sensitive_text()` 적용
3. **배치 임베딩:** 100개씩 배치로 OpenAI Embeddings API 호출
4. **벡터 저장:**
   - UUID 할당 (point id)
   - ingest_version 추가 (같은 evaluation_id의 이전 데이터 삭제용)
   - Qdrant에 upsert
5. **검증:** 실제 삽입 개수 == 예상 청크 수
6. **정리:** 이전 ingest_version 데이터 삭제 (같은 evaluation_id 범위)
7. **통계:**
   - inserted_count: 저장된 포인트 수
   - code_chunk_count: 코드/설정/API 청크
   - document_chunk_count: 문서 청크
   - manifest_chunk_count: file_manifest 청크
   - skipped_count: 추출되지 않은 문서 수

### 실패 조건

**RuntimeError 발생:**
- 코드 청크가 0개 인 경우 → "질문 생성에는 codebase source/config/test/overview 근거가 필요합니다"
- Qdrant 검증 실패 시 → "ingest verification failed"

---

## 7. 쿼리 검색

**파일:** `/backend/app/project_evaluations/rag/retriever.py`

### 쿼리 캐싱

**목적:** 같은 쿼리의 임베딩 API 호출 회피 (비용 절감)

**구현:**
- Process-local LRU 캐시 (최대 256개)
- 키: `(embedding_model, query)`
- 스레드 안전: threading.Lock 사용
- 수명: 프로세스 종료 시 소실

### 검색 함수

#### `retrieve_chunks()`

```python
chunks = retrieve_chunks(
    query="아키텍처 디자인 패턴",
    evaluation_id="eval-123",
    openai_client=openai_client,
    qdrant_client=qdrant_client,
    collection_name="project_evaluation_chunks",
    embedding_model="text-embedding-3-small",
    top_k=5,
    artifact_roles=["codebase_source", "codebase_config"],  # 선택적
    chunk_types=["code_symbol", "file_manifest"],            # 선택적
    source_types=["code"],                                    # 선택적
)
```

**반환:** `list[RetrievedChunk]`

#### `retrieve_texts()`

```python
texts = retrieve_texts(
    query="아키텍처",
    evaluation_id="eval-123",
    ...
)
```

**반환:** 청크 텍스트만 추출한 `list[str]`

### 검색 필터

Qdrant의 `Filter` 객체로 다음 조건을 AND로 결합:

- `evaluation_id` 정확 일치 (필수)
- `artifact_role` 포함 (선택적, 다중 선택 시 OR)
- `chunk_type` 포함 (선택적)
- `source_type` 포함 (선택적)

**예:**
- artifact_roles=["codebase_source", "codebase_test"] → role IN (source OR test)
- artifact_roles=["codebase_source"] → role == source

### RetrievedChunk 모델

```python
@dataclass(frozen=True)
class RetrievedChunk:
    text: str
    source_path: str
    artifact_id: str | None
    source_type: str | None
    artifact_role: str | None
    chunk_type: str | None
    score: float | None = None
    line_start: int | None = None
    line_end: int | None = None
    page_number: int | None = None
    slide_number: int | None = None
    section_title: str | None = None
    symbol_name: str | None = None
    metadata: dict[str, object] = field(default_factory=dict)
    
    def source_label(self) -> str:
        """경로 + 위치 정보 문자열 (예: "src/main.py:L10-L20")"""
```

---

## 8. Context Pack 생성

**파일:** `/backend/app/project_evaluations/rag/context_pack.py`

질문 생성 시 검색된 청크들을 조합하여 문맥 정보를 패키징한다.

### 구조

```python
@dataclass(frozen=True)
class ContextPack:
    snippets: list[str]              # 포맷된 청크 목록
    source_refs: list[dict[str, object]]  # 근거 참고문헌
    chunks: list[RetrievedChunk]     # 원본 청크 객체
    
    def empty(self) -> bool:
        return not self.snippets
```

### 쿼리 생성 (build_question_context_pack)

```python
context_pack = build_question_context_pack(
    retriever=retriever_func,
    project_summary="프로젝트 한 줄 요약",
    areas=[
        {"name": "Backend", "summary": "FastAPI"},
        {"name": "Frontend", "summary": "React"},
    ],
    max_chunks=18,  # 최대 18개 청크 선택
)
```

### 검색 쿼리 자동 생성

다음 6가지 관점에서 쿼리 자동 생성:

```python
[
    "프로젝트 전체 아키텍처 주요 모듈 데이터 흐름 [요약] [영역]",
    "zip 업로드 파일 추출 artifact 저장 전처리 흐름 [영역]",
    "RAG embedding Qdrant ingest retrieval context 질문 생성 흐름 [영역]",
    "프로젝트 문서 보고서 발표자료 설계 문서에 설명된 목표 기능 아키텍처 [요약]",
    "문서 주장과 코드 구현이 연결되는 지점 불일치 위험 검증 질문 [영역]",
    "예외 처리 오류 실패 TODO FIXME 트러블슈팅 한계 개선 [요약]",
]
```

각 쿼리마다:
- **코드 역할** (codebase_source, codebase_test, codebase_config, codebase_api_spec): top_k=8
- **문서 역할** (codebase_overview, project_report 등): top_k=3

### 청크 선택 정책 (_diverse_chunks)

1. **중복 제거:** (source_path, chunk_type, text[:120]) 기준 유일성
2. **경로당 한계:** 같은 source_path에서 최대 3개
3. **역할별 한계:**
   - 코드 역할: max(4, max_chunks) 개까지
   - 문서 역할: max(2, max_chunks // 3) 개까지
   - 기타: max(3, max_chunks // 2) 개까지
4. **순위 정렬:**
   - Role Priority: 코드 역할 우선 (0) > 문서 역할 (1)
   - Type Priority: file_manifest (0) > code_symbol (1) > project_document (2) > codebase_overview (3) > structured_config (4)
   - Score: 벡터 유사도 높은 순

### 포맷 (snippets)

각 청크를 다음 형식으로 포맷:

```
[artifact_role | chunk_type | source_label]
<redacted_text_first_1200_chars>
```

**예:**
```
[codebase_source | code_symbol | src/main.py:L10-L20]
def calculate_total(items: list[Item]) -> float:
    return sum(item.price for item in items)
```

### 근거 참고문헌 (_source_refs)

각 청크마다:

```python
{
    "path": "src/main.py",
    "snippet": "calculate_total 함수의 처음 240자",
    "artifact_id": "artifact-uuid",
    "page_or_slide": "page 3" or "slide 5" or null,
    "line_start": 10,
    "line_end": 20,
    "artifact_role": "codebase_source",
    "chunk_type": "code_symbol",
}
```

**중복 제거:** (source_path, line_start, page_number, slide_number, text[:80]) 기준

---

## 9. 민감정보 제거 (Redaction)

**파일:** `/backend/app/project_evaluations/rag/redaction.py`

청크 저장 및 검색 결과에 민감정보가 노출되지 않도록 자동 제거.

### 감지 패턴

| 패턴 | 예시 | 치환 |
|------|------|------|
| OpenAI API Key | `sk-...` (16+ 자) | `[REDACTED_SECRET]` |
| AWS Access Key | `AKIA0000000000000000` | `[REDACTED_SECRET]` |
| JWT Token | `eyJ...base64...` | `[REDACTED_SECRET]` |
| Secret 할당 | `API_KEY=sk-xxx`, `PASSWORD=123` | `API_KEY=[REDACTED_SECRET]` |

### 적용 시점

1. **임베딩 전:** 청크 텍스트 정제 (벡터 계산)
2. **저장 전:** Qdrant payload의 text 필드 정제
3. **검색 후:** 반환되는 청크의 text와 source_label 정제

---

## 10. 설정

**파일:** `/backend/app/settings.py`

| 환경변수 | 기본값 | 설명 |
|----------|--------|------|
| **OpenAI** | | |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | 임베딩 모델 |
| **Qdrant** | | |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant 서버 주소 |
| `QDRANT_COLLECTION_NAME` | `project_evaluation_chunks` | 컬렉션명 |
| **RAG 활성화** | | |
| `RAG_ENABLED` | `True` | RAG 사용 여부 (False → 규칙 기반 질문) |
| **파일 크기 제한** | | |
| `APP_MAX_UPLOAD_MB` | 50 | Zip 파일 최대 크기 |
| `APP_MAX_EXTRACTED_MB` | 150 | 압축 해제 총 크기 |
| `APP_MAX_TEXT_FILE_MB` | 10 | 단일 파일 최대 크기 |
| `APP_MAX_EXTRACTED_TEXT_CHARS` | 500,000 | 추출 텍스트 최대 문자 |
| **문서 페이지/슬라이드 제한** | | |
| `APP_MAX_PDF_PAGES` | 30 | PDF 최대 페이지 |
| `APP_MAX_DOCX_PARAGRAPHS` | 2,000 | DOCX 최대 단락 |
| `APP_MAX_PPTX_SLIDES` | 80 | PPTX 최대 슬라이드 |
| **Zip 멤버 제한** | | |
| `APP_MAX_ZIP_MEMBERS` | 2,000 | Zip 내부 파일 개수 |
| `APP_MAX_PROCESSED_FILES` | 1,000 | 처리할 파일 한도 |

---

## 11. RAG 비활성화 모드

`RAG_ENABLED=false`로 설정하면:

- Qdrant 검색 스킵
- 임베딩 API 호출 안 함
- 규칙 기반 질문 생성 (청크 메타데이터 기반)

---

## 12. 오류 처리 및 상태 추적

### Artifact Status

| 상태 | 의미 | 근거 검색 가능 |
|------|------|---------|
| `EXTRACTED` | 성공 | ✓ 예 |
| `SKIPPED` | 무시됨 (크기, 형식 등) | ✗ 아니오 |
| `FAILED` | 추출 중 오류 | ✗ 아니오 |

### 실패 원인 기록

- `reason` 메타데이터: "file_too_large", "extract_failed", "empty_text" 등
- `extract_error_type`: 예외 클래스 이름 (OSError, UnicodeError, ValueError 등)

---

## 13. 데이터 정리 정책

### Ingest Version

같은 evaluation_id로 재 업로드 시:

1. **새 UUID 할당:** 각 ingest마다 고유 ingest_version
2. **이전 데이터 유지:** 기존 버전 데이터는 그대로 유지 (현재는 미사용)
3. **최신 데이터 검색:** 검색 시 모든 버전 검색 (evaluation_id만 필터링)

---

## 관련 문서

- `/docs/project-evaluation-scope.md` — 프로젝트 평가 범위
- `/docs/architecture-decisions.md` — 주요 아키텍처 결정
- `/docs/api-and-job-flow.md` — API 및 작업 흐름
- `/docs/security-and-data-policy.md` — 보안 및 데이터 정책
