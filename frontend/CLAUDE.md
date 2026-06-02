# Frontend — Next.js

Next.js 16.2.6 · React 19 · TypeScript · pnpm · TanStack Query v5 · shadcn/ui · Tailwind CSS v4

## 실행

```bash
make frontend-dev      # pnpm dev (localhost:3000)
make frontend-build    # pnpm build
make frontend-types    # OpenAPI 스키마에서 타입 재생성
make frontend-lint     # eslint
```

## 라우트 맵

| 경로 | 역할 |
|------|------|
| `/` | 홈 — 평가 생성/관리 진입 |
| `/create` | 평가 생성 위자드 (zip 업로드, GitHub URL, 설정) |
| `/admin` | 관리자 대시보드 — 평가 목록 |
| `/admin/[evaluationId]` | 개별 평가 관리 콘솔 |
| `/interview/[evaluationId]/join` | 학생 참여 폼 |
| `/interview/[evaluationId]/session/[sessionId]` | 인터뷰 진행 (텍스트 + 음성) |
| `/interview/[evaluationId]/report` | 검증 리포트 조회 |

## 핵심 패턴

- **API 클라이언트**: `lib/api/client.ts` — `apiFetch<T>()` wrapper. `NEXT_PUBLIC_API_BASE_URL`(브라우저) / `INTERNAL_API_BASE_URL`(SSR) 분리
- **타입 생성**: `pnpm openapi:gen` → `src/lib/api/types.gen.ts` (백엔드 OpenAPI에서 자동 생성)
- **위자드 상태**: `lib/wizard/state.tsx` — 다단계 생성 흐름 상태 머신
- **오디오**: `lib/audio/` — Web Speech API STT + 백엔드 TTS streaming
- **UI 컴포넌트**: `components/ui/` — shadcn/ui (Radix 기반)
- **차트**: @nivo/bar, @nivo/radar (리포트 시각화)

상세 내용은 `docs/` 참조 (architecture, api-flow, conventions).
