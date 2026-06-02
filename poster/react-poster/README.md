# Dialearn A0 포스터 (react-poster)

캡스톤 최종 발표용 **세로 A0(841×1189mm)** 학술 포스터. React + Vite + mermaid.

본문은 **산문(문단)** 형식이며, 시스템 구조·처리 흐름은 **mermaid SVG** 다이어그램 2개로 표현한다(우수작 형식 미러).

## 설계 원칙: 화면 = 인쇄 (WYSIWYG)

- `.poster`는 **고정 1400×1979px 캔버스 하나**만 존재한다(A0 비율 1400:1979 ≈ 841:1189). 화면과 인쇄가 **동일한 DOM**을 공유한다.
- 본문은 좌우 2단 그리드이며, 세로 공간은 flex 로 분배한다: 산문 블록은 자연 높이, 다이어그램 블록(`.diagram-section`)은 `flex:1`(잔여 공간 흡수)로 **캔버스를 정확히 채운다**(여백·잘림 0).
- mermaid 는 정적 SVG 를 만들고 `.mermaid-host svg { width:100%; height:100% }` 로 컨테이너에 맞춘다. React Flow 의 `fitView` 처럼 **컨테이너 픽셀을 측정**하지 않으므로 인쇄/캡처 시 칸 넘침이 근본적으로 발생하지 않는다.
- 인쇄/내보내기는 화면 레이아웃을 **그대로 고해상도 래스터화**할 뿐, 레이아웃을 바꾸는 변환을 쓰지 않으므로 결과가 화면과 픽셀 비례로 동일하다.

## 개발

```bash
yarn dev        # http://localhost:5173
yarn build      # 타입체크 + 프로덕션 번들
```

## A0 내보내기 (권장: 고해상도 PNG, 무의존성)

화면을 그대로 고배율 캡처한다. 화면 픽셀을 그대로 확대하므로 **인쇄물 = 화면**이 보장된다.
[agent-browser](https://www.npmjs.com/package/agent-browser)만 사용하며 별도 의존성 설치가 없다.

```bash
# dev 서버가 떠 있는 상태에서
agent-browser open http://localhost:5173
agent-browser set viewport 1400 1979 4     # deviceScaleFactor 4 → A0 @ ~169dpi
# 폰트 + 두 mermaid 다이어그램 렌더 완료까지 대기(__diagramsReady 플래그)
agent-browser eval "(async()=>{await document.fonts.ready;for(let i=0;i<80;i++){if(window.__diagramsReady===true)break;await new Promise(r=>setTimeout(r,100));}return window.__diagramsReady===true})()"
agent-browser screenshot poster-A0.png      # 5600 × 7916 px (= 841 × 1189mm @169dpi)
```

- 더 높은 인쇄 해상도가 필요하면 viewport 의 3번째 인자(deviceScaleFactor)를 5~6으로 올린다.
  - dsf 5 → 7000×9895px(≈211dpi), dsf 6 → 8400×11874px(≈253dpi). 메모리 사용 증가 주의.
- 산출 PNG를 인쇄소에 A0로 전달하면 화면과 동일한 결과가 나온다.

## A0 벡터 PDF (선택: 브라우저 Cmd+P)

벡터(텍스트·SVG 보존)가 필요하면 Chrome 에서 직접 인쇄한다.

1. Chrome 으로 `http://localhost:5173` 접속
2. `Cmd+P` → 대상 "PDF로 저장"
3. 용지 크기를 **A0**로, 배율 **100%**, 여백 **없음**으로 설정
4. `@media print`가 캔버스를 균일 스케일(×2.2698)로 A0 에 맞춘다(레이아웃 reflow 없음 → 화면과 동일 구성)

> 참고: `agent-browser pdf`는 `@page` 크기를 반영하지 못해(Letter 고정) A0 PDF 용도로는 쓰지 않는다. PDF 가 필요하면 위 Chrome 수동 인쇄를 사용한다.

## 검증 (agent-browser)

```bash
# 캔버스 채움/잘림 점검: posterScrollH 가 1979 이고 bodyScrollH == bodyH 이면 OK
agent-browser eval "(() => { const p=document.querySelector('.poster'); const b=document.querySelector('.body-wrap'); return JSON.stringify({posterScrollH:p.scrollHeight, bodyH:b.offsetHeight, bodyScrollH:b.scrollHeight}); })()"
```

화면 캡처와 인쇄(PNG/PDF) 결과의 레이아웃·줄바꿈·다이어그램 위치가 일치하는지 비교한다.

## 구조

- `src/App.tsx`: 포스터 레이아웃(헤더 / 좌단: 작품개요·주요기능 / 우단: 시스템구조·동작원리·결과물 / 기대효과 / 푸터)
- `src/poster.css`: 고정 캔버스·좌우 2단 flex 분배·산문 타이포·디자인 토큰·`@media print`
- `src/main.tsx`: mermaid 부트스트랩(`mermaid.initialize` 테마 + `registerIconPacks(logos)` 로컬 아이콘, 네트워크 의존 0)
- `src/components/Mermaid.tsx`: mermaid 정의를 SVG 로 렌더해 주입(`.mermaid-host`), 완료 시 `window.__diagramsReady` 갱신
- `src/diagrams/architecture.ts`: 시스템 구조(`architecture-beta`, logos 아이콘). 한글 라벨은 반드시 `["..."]` 로 감싼다.
- `src/diagrams/flow.ts`: 처리 흐름(`flowchart LR` + `classDef` 색 구분)

## 결과물 스크린샷

`public/screenshots/` 에 워크플로우 순서로 3장을 둔다. 이미지가 없으면 "스크린샷 준비 중" 플레이스홀더가 표시된다.

| 순서 | 파일 | 내용 |
|---|---|---|
| ① | `04_admin_console.png` | 교수자 평가 개요 화면(관리 콘솔) |
| ② | `interview_session.png` | 학생 인터뷰 진행 화면 |
| ③ | `report.png` | 학생 검증 리포트 화면 |
