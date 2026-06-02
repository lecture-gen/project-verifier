# 보안 정책

**마지막 업데이트**: 2025-05-27

Dialearn은 대학교 캡스톤디자인 실습 프로젝트로, 실용적인 보안을 적용하되 엔터프라이즈 수준의 과도한 보안 요구를 기본 전제로 삼지 않습니다. 이 문서는 시스템에 구현된 실제 보안 장치를 설명합니다.

## 1. Zip 파일 처리 안전장치

학생이 업로드한 zip 파일은 `app/project_evaluations/ingestion/zip_handler.py`에서 검사 및 추출됩니다.

### 1.1 경로 침투(Path Traversal) 방지

```python
def safe_target_path(extract_dir: Path, member_name: str) -> Path:
    target_path = (extract_dir / member_name).resolve()
    root = extract_dir.resolve()
    if not target_path.is_relative_to(root):
        raise HTTPException(...)
```

- 모든 zip 멤버 경로를 검증
- 절대 경로(`/` 시작) 거부
- `..` 경로 침투 패턴 거부
- 추출 후 위치가 extract_dir 내부인지 확인

### 1.2 심볼릭 링크 및 위험 문자 검사

```python
def is_safe_zip_member(name: str) -> bool:
    # 역슬래시, null 바이트, 절대 경로 (Windows 드라이브 문자) 거부
    if "\\" in name or "\x00" in name or ":" in path.parts[0]:
        return False
    if path.is_absolute() or ".." in path.parts:
        return False
```

### 1.3 파일/크기 제한

| 제한 항목 | 값 | 용도 |
|---------|-----|------|
| **업로드 크기** | 50 MB | 초기 zip 파일 크기 상한 |
| **압축 해제 크기** | 150 MB | 전체 압축 해제 합계 |
| **개별 파일 크기** | 10 MB | 텍스트 추출용 파일 상한 |
| **Zip 멤버 개수** | 2,000개 | 압축 폭탄 방지 |
| **처리 파일 개수** | 1,000개 | RAG 수집 리소스 보호 |

**검사 방식**:
- 업로드 시점: 원본 zip 크기 검사
- 추출 전: zip 내 모든 파일 크기 합계 검사
- 추출 중: 개별 파일 크기 초과 시 스킵

## 2. 무시되는 경로

다음 디렉터리와 확장자는 자동으로 필터링됩니다.

### 2.1 무시 디렉터리

```
.git
.venv
__pycache__
build
dist
node_modules
target
vendor
```

### 2.2 무시 확장자

| 카테고리 | 확장자 |
|---------|--------|
| 이미지 | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico` |
| 비디오/오디오 | `.mp3`, `.mp4`, `.avi` |
| 바이너리 | `.bin`, `.class`, `.dll`, `.dylib`, `.exe`, `.o`, `.so` |
| 문서 | `.pdfx` (pdf는 허용) |

**주의**: `.lock` 파일(uv.lock, Gemfile.lock 등)은 의존성 검증이 필요하므로 **포함**합니다.

## 3. 지원 파일 형식

### 3.1 코드 파일

Python, JavaScript/TypeScript, Java, Kotlin, Go, Rust, C/C++, HTML, CSS, SCSS, JSON, YAML, TOML, SQL 등 32개 확장자

### 3.2 문서 파일

- `.md`, `.txt` — 텍스트 추출
- `.pdf` — PDF 파싱 (최대 30 페이지)
- `.docx` — Word 파싱 (최대 2,000 단락)
- `.pptx` — PowerPoint 파싱 (최대 80 슬라이드)

### 3.3 설정 파일

`package.json`, `pyproject.toml`, `go.mod`, `docker-compose.yml` 등 28개 파일

## 4. 세션 인증

### 4.1 암호 저장

`app/core/security.py`에서 PBKDF2 해싱 사용:

```python
PASSWORD_HASH_ITERATIONS = 120_000

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)  # 16바이트 무작위 salt
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,  # 120,000번 반복
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${digest}"
```

**특징**:
- 알고리즘: PBKDF2-SHA256
- 반복: 120,000회
- Salt: 16바이트 무작위

### 4.2 세션 토큰 생성

```python
def new_session_token() -> str:
    return secrets.token_urlsafe(32)  # 32바이트 URL-safe 토큰
```

## 5. 인증 속도 제한

`app/core/rate_limit.py`에서 단순 in-process rate limiting:

| 파라미터 | 값 | 용도 |
|---------|-----|------|
| 시간 윈도우 | 60초 | 검사 기간 |
| 최대 실패 횟수 | 8회 | 윈도우당 허용 실패 시도 |

**구현**:
- 평가별, 세션별 실패 추적
- 윈도우 내 실패 8회 초과 시 HTTP 429 반환
- "인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요."

## 6. CORS 정책

### 6.1 명시적 Origin 화이트리스트

`app/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,  # 환경 변수에서 읽음
    allow_credentials=True,                      # 쿠키 전송 허용
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### 6.2 설정

`.env.example`:

```
# 콤마 분리. 정확한 origin 만 허용한다 (와일드카드 금지).
CORS_ALLOW_ORIGINS=http://localhost:3000
```

**주의**: 쿠키 기반 인증(allow_credentials=True)을 사용하므로 와일드카드(`*`) 허용 불가.

**프로덕션**에서는 명시적으로 배포 도메인 설정:

```bash
CORS_ALLOW_ORIGINS=https://dialearn.example.com
```

## 7. 민감정보 보호

### 7.1 환경 변수 관리

모든 시크릿(API 키, DB 연결 등)은 환경 변수 또는 `.env` 파일에서 로드합니다.

**소스 코드에 하드코딩된 시크릿 금지**:
- OpenAI API 키
- Qdrant 토큰
- 기타 인증 자격 증명

### 7.2 민감정보 마스킹

RAG 질문 생성 시 `app/project_evaluations/rag/redaction.py`에서 민감정보 자동 제거:

```python
SECRET_ASSIGNMENT_PATTERN  # API_KEY=sk-xxxx 패턴
OPENAI_KEY_PATTERN         # sk-xxx...
AWS_ACCESS_KEY_PATTERN     # AKIA...
JWT_PATTERN                # eyJ...
```

**적용 대상**:
- 질문/답변 맥락에 포함된 환경 변수
- 코드 스니펫에서 노출된 토큰
- RAG 문서에 기록된 시크릿

### 7.3 에러 응답

- 스택 트레이스 노출 금지
- 사용자 입력 오류는 일반 메시지만 반환
- 데이터베이스 오류 상세 정보 로깅만 (외부 노출 안 함)

## 8. 데이터 저장

### 8.1 파일 시스템

| 경로 | 용도 | 보존 기간 |
|------|------|---------|
| `data/app.db` | SQLite 데이터베이스 (평가 메타데이터, 세션) | 명시 삭제 전 |
| `data/artifacts/` | 추출된 zip 아티팩트 | 명시 삭제 전 |

### 8.2 데이터베이스

**SQLite3** 사용:
- 파일 기반 (별도 서버 불필요)
- 개발/데모 환경에 적합
- 프로덕션: PostgreSQL 권장

**스키마**:
- 평가(Evaluation) 메타데이터
- 세션(Session) 토큰 및 암호
- 아티팩트(Artifact) 메타데이터
- 라운드(Round) 질문/답변 기록

### 8.3 벡터 데이터베이스

**Qdrant** (Docker 컨테이너):

```yaml
volumes:
  dialearn_qdrant_storage:
```

- OpenAI embedding-3-small 임베딩 저장
- Artifact role 메타데이터
- TTL 정책 없음 (명시 삭제 필요)

## 9. 민감정보 처리 정책

### 9.1 학생 비밀번호

- PBKDF2-SHA256으로 해싱하여 저장
- 평문으로 복원 불가

### 9.2 업로드 자료

- 평가별 `evaluation_id` 디렉터리에 격리
- 필요시 삭제 가능
- 접근 제어: 해당 평가의 세션 토큰 필요

### 9.3 LLM 질문 생성

- 민감정보(시크릿)는 마스킹 후 전송
- OpenAI API 호출 기록은 최소화
- 질문 텍스트에 실제 토큰 미포함

## 10. 데이터 초기화

`scripts/reset-demo-data.sh`로 전체 데이터 재설정:

```bash
# SQLite DB 삭제
rm -f data/app.db data/app.db-journal

# 아티팩트 삭제
find data/artifacts -mindepth 1 ! -name .gitkeep -exec rm -rf {} +

# Qdrant 컬렉션 삭제 (선택)
./scripts/reset-demo-data.sh --qdrant
```

**Makefile** 지원:

```bash
make reset-demo-data
make reset-demo-data ARGS="--qdrant"
```

## 11. 알려진 제한사항

### 11.1 Demo 프로젝트 특성

- 암호 초기화(forgot password) 기능 없음
- SSL/TLS 기본 설정 없음 (프로덕션 필수)
- Rate limiting은 in-process (다중 서버 시 부분적)
- 감사 로그(Audit Log) 미구현

### 11.2 향후 개선사항

- PostgreSQL 마이그레이션 + 권한 관리
- JWT 기반 인증 (세션 대체)
- 감사 로그 및 파일 무결성 검증
- TLS/HTTPS 의무화
- 분산 rate limiting (Redis)

## 12. 보안 체크리스트

배포 전 확인 사항:

- [ ] `OPENAI_API_KEY` 환경 변수 설정 (`.env`에 하드코딩 금지)
- [ ] `CORS_ALLOW_ORIGINS` 실제 도메인으로 설정
- [ ] `PUBLIC_WEB_BASE_URL` 프로덕션 URL로 업데이트
- [ ] SQLite `data/app.db` 경로 쓰기 가능한 위치 확인
- [ ] `data/artifacts/` 디렉터리 접근 권한 제한
- [ ] Qdrant 외부 접근 비활성화 (docker-compose 포트 제한)
- [ ] 정기적인 `reset-demo-data.sh` 실행 (테스트 데이터 정리)

## 13. 문제 보고

보안 문제 발견 시:

1. 즉시 이 프로젝트의 담당자에게 연락
2. 공개적으로 공개하지 말 것
3. 영향 범위와 재현 방법 상세 기술
