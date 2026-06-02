<!--
  Dialearn 캡스톤 전시회 포스터 — Poster B 디자인 시스템.
  원본: Claude Design 핸드오프 번들 dialearn-poster/project/poster/ (Poster B.html · poster-base.css · diagrams.js).
  본 문서는 google-labs-code/design.md 포맷을 따른다. 토큰은 포스터 원본의 시맨틱 이름을 유지한다.
-->
---
version: alpha
name: Dialearn Poster B
description: 한성대 지능시스템 캡스톤 전시회용 A0 포스터. 모던 미니멀 — 차콜·그레이 중립 시스템 + 포인트 1색(틸). 다크 헤더 + 가로 밴드 + 다크 풋터.
colors:
  # 중립 잉크/페이퍼 스케일 (poster-base.css)
  ink: "#17171a"          # 제목·강조 텍스트, 헤더·풋터 다크 바
  ink-2: "#34343a"        # 본문
  muted: "#6b6b73"        # 설명·메타·lead·캡션
  faint: "#9a9aa2"        # 보조·플레이스홀더 라벨·다이어그램 엣지
  line: "#e6e5e1"         # 헤어라인
  line-2: "#d6d5d0"       # 강한 헤어라인
  paper: "#ffffff"        # 본문 바탕·카드
  paper-2: "#f6f5f2"      # 패널·기능 카드 배경
  paper-3: "#efeeea"      # 더 짙은 패널(점선 스트라이프)
  page: "#d9d8d3"         # A0 캔버스 바깥 바탕(html/body)
  # 포인트 1색 — Poster B = 틸 (Poster B.html :root)
  accent: "#0e8a7e"       # 강조·번호 배지·보더·다이어그램 핵심 노드
  accent-ink: "#0a665d"   # accent 텍스트(본문 strong, 캡션 강조)
  accent-wash: "#def0ed"  # 연한 accent 배경(액터 배지, docker 존)
  # 다이어그램 분류 그레이 스텝 (카드 좌측 4px 보더 색)
  diagram-step-1: "#b8b7b1"  # 인프라(proxy·qdrant·sqlite)
  diagram-step-2: "#8a8a90"  # web·rag
  diagram-step-3: "#5b5b62"  # agent
typography:
  header-title:
    fontFamily: Pretendard
    fontSize: 75px
    fontWeight: "800"
    lineHeight: 0.92
    letterSpacing: -0.025em
  header-subtitle:
    fontFamily: Pretendard
    fontSize: 22.5px
    fontWeight: "600"
    lineHeight: 1.3
    letterSpacing: -0.01em
  kicker:
    fontFamily: Pretendard
    fontSize: 16.2px
    fontWeight: "800"
    letterSpacing: 0.15em
  section-title:
    fontFamily: Pretendard
    fontSize: 21px
    fontWeight: "800"
    letterSpacing: -0.01em
  feature-title:
    fontFamily: Pretendard
    fontSize: 16.5px
    fontWeight: "800"
  feature-body:
    fontFamily: Pretendard
    fontSize: 14.25px
    fontWeight: "400"
    lineHeight: 1.58
  body:
    fontFamily: Pretendard
    fontSize: 15.6px
    fontWeight: "400"
    lineHeight: 1.66
  lead:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 1.62
  impact-title:
    fontFamily: Pretendard
    fontSize: 16.8px
    fontWeight: "800"
  card-title:
    fontFamily: Pretendard
    fontSize: 15px
    fontWeight: "800"
    lineHeight: 1.2
  card-desc:
    fontFamily: Pretendard
    fontSize: 11.5px
    fontWeight: "400"
    lineHeight: 1.34
  chip:
    fontFamily: Pretendard
    fontSize: 12.3px
    fontWeight: "700"
rounded:
  xs: 2px        # accent 키커 라인, 결과 캡션 불릿
  sm: 7px        # 섹션 번호 배지(band-head .idx)
  md: 9px        # 다이어그램 카드(dg-card)
  lg: 11px       # 기능 카드(feature)
  xl: 14px       # 헤더 QR 박스
  full: 999px    # 풋터 스택 칩(알약), 다이어그램 액터 배지
spacing:
  root: 15px           # 루트 폰트 크기(rem 환산 기준)
  band-x: 56px         # 밴드 좌우 패딩
  band-y: 20px         # 밴드 상하 패딩
  overview-gap: 40px   # 작품 개요 2단 간격
  features-gap: 22px   # 주요 기능 4단 간격
  diagram-gap: 44px    # 시스템 구조 / 동작 원리 좌우 간격
  result-gap: 18px     # 결과물 3칸 간격
  impact-gap: 20px     # 기대 효과 3칸 간격
  canvas-w: 1400px     # A0 고정 캔버스 폭
  canvas-h: 1979px     # A0 고정 캔버스 높이 (1400:1979 ≈ 841:1189mm)
  print-scale: 2.2698  # 1400px → 841mm 균일 확대 배율(@media print)
components:
  header-bar:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    padding: 38px 56px
  section-index:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    typography: "{typography.feature-title}"
    rounded: "{rounded.sm}"
    size: 30px
  feature-card:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.feature-body}"
    rounded: "{rounded.lg}"
    padding: 17px 18px 16px
  diagram-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.card-title}"
    rounded: "{rounded.md}"
    padding: 10px 13px
  diagram-card-actor:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.card-desc}"
    rounded: "{rounded.full}"
    padding: 3px 8px
  result-placeholder:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.faint}"
    rounded: 6px
  impact-item:
    textColor: "{colors.ink-2}"
    typography: "{typography.impact-title}"
  footer-bar:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    padding: 22px 56px
  stack-chip:
    backgroundColor: transparent
    textColor: "#e0e0e4"
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
    padding: 5px 13px
---

## Overview

Dialearn 포스터 B는 한성대학교 지능시스템 캡스톤디자인 전시회에서 인쇄·게시할 **A0 학술 포스터**다. 웹(HTML/CSS)으로 디자인한 뒤 브라우저 인쇄로 PDF를 뽑아 실제 A0(841×1189mm)로 출력하는 것을 전제로 한다.

디자인 방향은 **모던 미니멀**이다. 차콜·그레이 중립 시스템이 지면 전체를 잡고, 포인트는 **틸(accent #0e8a7e)** 한 색으로 제한한다. 화면이 곧 인쇄가 되도록(WYSIWYG) 캔버스를 **1400×1979px로 고정**하고, 인쇄 시 `@media print`에서 2.2698배 균일 확대해 A0로 떨군다.

구성은 세로 흐름이다. **다크 헤더**(제목·부제·QR) → 번호가 붙은 **가로 밴드 6섹션**(① 작품 개요 → ② 주요 기능 → ③ 시스템 구조 / ④ 동작 원리 → ⑤ 결과물 → ⑥ 기대 효과) → **다크 풋터**(팀·스택). 시스템 구조와 동작 원리 두 다이어그램 밴드가 잔여 높이를 흡수해 지면을 꽉 채운다. 1/3폭 사이드바 대신 가로 밴드를 택한 이유는 폭이 넓은 다이어그램을 작게 줄이지 않고 선명하게 싣기 위해서다.

## Colors

색은 **중립 스케일 + 포인트 1색** 원칙으로 운용한다.

- 텍스트 위계: **ink (#17171a)** 제목·강조, **ink-2 (#34343a)** 본문, **muted (#6b6b73)** 설명·메타·lead, **faint (#9a9aa2)** 보조·플레이스홀더.
- 면과 선: 바탕은 **paper (#ffffff)**, 패널·카드는 **paper-2 (#f6f5f2)**, 더 짙은 단차는 **paper-3 (#efeeea)**. 구획선은 **line (#e6e5e1)** / **line-2 (#d6d5d0)** 두 단계 헤어라인. 캔버스 바깥은 **page (#d9d8d3)**.
- 포인트: **accent (#0e8a7e)** 틸 하나가 강조의 전부다. 번호 배지, 키커 라인, 섹션 구분선, 기대 효과 상단 보더, 다이어그램 핵심 노드까지 모두 이 색으로만 끈다. 텍스트로 쓸 때는 더 짙은 **accent-ink (#0a665d)**, 연한 배경은 **accent-wash (#def0ed)**.
- 다이어그램: 색은 의미를 운반한다. **accent = 핵심 노드**(client·api·io·report·decision), **diagram-step-1~3 (#b8b7b1 → #8a8a90 → #5b5b62)** 그레이 스텝 = 인프라·중간 단계, **ink** = 외부 의존(OpenAI). 두 번째 강조색은 쓰지 않는다.

다크 헤더·풋터는 **ink** 배경에 흰 텍스트, 하단/상단 경계만 6px **accent** 선으로 끊는다.

## Typography

서체는 **Pretendard** 단일 패밀리(`system-ui` 폴백), 루트 15px를 기준으로 rem 스케일을 쓴다.

- 위계는 스케일 대비로 만든다. 헤더 제목 **header-title (75px / 800 / line-height 0.92)** 가 지면의 시선을 단번에 잡고, 부제 **header-subtitle (22.5px / 600)** 이 한 문장으로 받친다. 섹션 제목 **section-title (21px / 800)**, 기능 제목 **feature-title (16.5px / 800)** 으로 단계가 내려간다.
- 본문 **body (15.6px / line-height 1.66)** 는 `text-align: justify` 로 양끝을 맞춰 학술 포스터의 정돈된 밀도를 낸다. 다이어그램 설명문 **lead (15px / 1.62)** 는 좌측 3px **accent** 보더가 붙은 인용문 형태다.
- 웨이트는 네 단계로 절제한다 — **800**(헤딩·번호·강조), **700**(라벨·칩), **600**(부제), **400**(본문). 별색 없이 굵기와 색(accent-ink)만으로 강조를 처리한다.
- 한글 가독성을 위해 `word-break: keep-all` 로 어절 단위 줄바꿈을 유지한다.

## Layout

- **고정 A0 캔버스**: `.poster` 는 **1400×1979px**(≈ 841:1189mm)로 못박고 `overflow: hidden`. 화면에서 보이는 그대로가 인쇄물이다.
- **세로 flex 흐름**: 헤더(`flex: 0 0 auto`) → 밴드 스택(`flex: 1 1 0`) → 풋터(`flex: 0 0 auto`). 밴드 패딩은 좌우 **band-x (56px)** · 상하 **band-y (20px)**.
- **밴드 내부 그리드**: 작품 개요 2단(gap **40px**), 주요 기능 4단(gap **22px**), 시스템 구조/동작 원리 **1.12fr / 0.88fr**(gap **44px**), 결과물 3칸(gap **18px**), 기대 효과 3칸(gap **20px**).
- **잔여 높이 흡수**: 다이어그램 밴드(`.band.flex`)와 그 안의 `.dg-host` 가 `flex: 1 1 0; min-height: 0` 으로 남는 세로 공간을 채워, 콘텐츠 양과 무관하게 지면이 정확히 1979px에 맞는다.
- **인쇄**: `@media print` 에서 `@page { size: 841mm 1189mm; margin: 0 }`, `.poster { transform: scale(2.2698) }`. transform은 레이아웃을 바꾸지 않으므로 화면=인쇄가 픽셀 비례로 동일하다. 브라우저 인쇄 대화상자에서 **용지 A0 · 배율 100% · 여백 없음** 으로 저장한다.

## Elevation & Depth

인쇄물이므로 **그림자는 쓰지 않는다(flat by design)**. 깊이는 빛이 아니라 대비와 단차로만 만든다.

- **바 대비**: 다크 헤더·풋터(**ink**) ↔ 화이트 본문(**paper**) 의 명도 대비가 지면을 위·중·아래로 가른다.
- **면 단차**: **paper → paper-2 → paper-3** 3단계 회색조로 카드·패널을 본문에서 살짝 띄운다. 경계는 그림자 없이 **line / line-2** 헤어라인으로만 정의한다.
- **방향 단서**: 다이어그램 카드(`dg-card`)는 좌측 4px 컬러 보더로 분류와 위계를 동시에 표시한다. docker 존은 **accent** 점선(`stroke-dasharray: 7 5`) 경계, oracle 존은 옅은 회색 경계로 감싼다.
- **플레이스홀더**: 결과물 빈 칸은 45° 반복 스트라이프(`paper-2`/`paper-3`)와 점선 테두리로 "준비 중" 상태를 평면적으로 드러낸다.

## Shapes

라운드는 작은 값으로 절제하되 일관된 스케일을 둔다 — **xs 2px**(키커 라인·불릿) → **sm 7px**(번호 배지) → **md 9px**(다이어그램 카드) → **lg 11px**(기능 카드) → **xl 14px**(헤더 QR). 유일한 예외는 풋터 스택 칩과 다이어그램 액터 배지로, **full (999px)** 알약 형태를 써서 단단한 사각 면들 사이에서 메타 정보를 구분한다.

번호 배지는 7px 라운드 사각(틸 면 + 흰 숫자), 키커는 26×3px 막대다. 아이콘·도형은 선 기반으로, 다이어그램 엣지(1.7px)·존 보더(1.5px)·카드 보더(1.5px) 등 가는 획 두께를 맞춰 균질하게 유지한다.

## Components

- **header-bar / footer-bar**: **ink** 배경 + 흰 텍스트의 대칭 다크 바. 헤더는 하단 6px **accent** 보더, 풋터는 한 줄 구성(왼쪽 팀, 오른쪽 스택 칩).
- **section-index**: 30px 정사각 **accent** 배지 + 흰 숫자(01–06). 섹션 제목 왼쪽에 붙고 오른쪽으로 `line-2` 구분선이 뻗는다.
- **feature-card**: **paper-2** 단색 배경 + 1px **line** 헤어라인 + **lg(11px)** 라운드. 번호(01–04)는 `decimal-leading-zero` 카운터로 자동 매김. *상단 강조 보더 없이* 단색 카드로 둔다(사용자 확정 사항).
- **diagram-card**: **paper** 배경 + 좌측 4px 분류색 보더 + **md(9px)** 라운드. 머리에 **diagram-card-actor**(accent-wash 알약) + 제목, 아래 회색 설명(card-desc).
- **result-placeholder**: 16:10 점선 박스(1.5px dashed **line-2**) + 모니터 아이콘 + **accent** 불릿 캡션. 실제 스크린샷으로 교체하는 자리.
- **impact-item**: 상단 3px **accent** 보더 + 제목 + 본문. 점수 하나로 묶지 않고 영역별로 나눠 보여 주는 카드.
- **stack-chip**: 투명 배경 + `rgba(255,255,255,0.24)` 1px 보더 + **full** 알약. 풋터 우측에 핵심 스택 6개(Next.js · FastAPI · OpenAI · Qdrant · SQLite · Docker)만 단순 나열.

## Do's and Don'ts

**Do**
- 포인트색은 **accent(틸)** 하나로만 끝낸다. 강조가 필요하면 굵기(800)나 **accent-ink** 텍스트로 처리한다.
- 캔버스는 **1400×1979px** 비율을 고정한다. 콘텐츠가 늘면 `flex` 다이어그램 영역이 흡수하게 두고, 비율 자체는 건드리지 않는다.
- 다이어그램 색 분류 규칙(**accent = 핵심 노드**, **그레이 스텝 = 인프라/중간**, **ink = 외부 의존**)을 지킨다.
- 본문은 한국어 산문형으로, 어절 단위 줄바꿈(`keep-all`)과 양끝 정렬을 유지한다.

**Don't**
- 두 번째 강조색을 추가하지 않는다(중립 + 1색 원칙).
- 기능 카드에 상단 강조 보더 같은 장식을 다시 넣지 않는다 — 단색 카드로 둔다.
- 풋터에 버전·개발환경(uv·pnpm·임베딩 모델명 등) 잡다한 정보를 나열하지 않는다(시스템 구조 다이어그램이 이미 보여 준다).
- 그림자로 깊이를 만들지 않는다. 깊이는 대비·면 단차·헤어라인으로만.
