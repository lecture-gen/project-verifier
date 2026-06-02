/**
 * 다이어그램 2. 동작 원리 — 2행 U자 뱀형 프로세스 맵 (자체 SVG)
 *
 * mermaid auto-layout(dagre·elk)은 9단계 순차 흐름을 한 방향으로만 펴서, LR 은 약 5:1 로
 * 너무 넓고 TB 는 약 0.6:1 로 너무 길었다. 가로형 섹션 박스(약 1.9:1)를 채우려면 흐름을
 * 두 줄로 접어야 하는데, 클러스터 간 엣지 때문에 mermaid 는 뱀형 접기를 못 한다.
 *
 * 그래서 이 다이어그램만 직접 SVG 로 그린다. 포스터는 고정 캔버스를 균일 스케일하므로
 * viewBox 좌표가 안정적이고, `.mermaid-host svg{width:100%;height:100%}` 와 같은 규칙으로
 * 박스에 꼭 맞게 스케일된다(.dg-host). 카드 텍스트는 mermaid 가 쓰던 것과 같은
 * foreignObject(HTML) 로 넣어 한글 줄바꿈을 안정적으로 처리한다.
 *
 *   윗줄(준비)   : 자료제출 → RAG 색인 → ① 컨텍스트 → ② 품질 → ③ 질문생성
 *   캐리지리턴   : ③ → (학생) 답변
 *   아랫줄(검증) : 답변 → ④ 채점 → ◇근거충분? →(충분) ⑤ 리포트
 *   루프         : ◇ →(부족) 꼬리질문 → 답변
 *
 * 색상 토큰은 기존 mermaid classDef(io/ragc/agent/decision/report)와 동일하게 맞춘다.
 */

const VIEW_W = 1000
const VIEW_H = 540

type Variant = 'io' | 'rag' | 'agent' | 'decision' | 'report'

interface CardNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  variant: Variant
  actor?: string
  title: string
  desc: string
}

const CARD_W = 180
const CARD_H = 122
const ROW1_Y = 20
const ROW2_Y = 312
const STEP = 198 // 카드 폭 + 간격
const COL = [14, 14 + STEP, 14 + STEP * 2, 14 + STEP * 3, 14 + STEP * 4] // 5열 x 좌표

const CARDS: CardNode[] = [
  // ── 윗줄: 준비 단계 ──
  { id: 'up', x: COL[0], y: ROW1_Y, w: CARD_W, h: CARD_H, variant: 'io', actor: '교수자', title: '자료 제출', desc: '평가자가 ZIP·GitHub로 업로드' },
  { id: 'rag', x: COL[1], y: ROW1_Y, w: CARD_W, h: CARD_H, variant: 'rag', actor: '시스템', title: 'RAG 색인', desc: '역할별 청킹·민감정보 마스킹 후 Qdrant에 임베딩' },
  { id: 'a1', x: COL[2], y: ROW1_Y, w: CARD_W, h: CARD_H, variant: 'agent', title: '① 컨텍스트 분석', desc: '기술스택·기능·구조로 프로젝트 맥락 파악' },
  { id: 'a2', x: COL[3], y: ROW1_Y, w: CARD_W, h: CARD_H, variant: 'agent', title: '② 품질 평가', desc: '완성도·작업량으로 평가 기준선 설정' },
  { id: 'a3', x: COL[4], y: ROW1_Y, w: CARD_W, h: CARD_H, variant: 'agent', title: '③ 질문 생성', desc: '자료 근거로 Bloom 6단계 질문·루브릭 생성' },
  // ── 아랫줄: 인터뷰·검증 단계 ──
  { id: 'ans', x: COL[0], y: ROW2_Y, w: CARD_W, h: CARD_H, variant: 'io', actor: '학생', title: '답변', desc: '텍스트 · 음성(STT/TTS)' },
  { id: 'a4', x: COL[1], y: ROW2_Y, w: CARD_W, h: CARD_H, variant: 'agent', title: '④ 답변 채점', desc: '루브릭 채점, 자료와의 근거 일치 확인' },
  { id: 'a5', x: COL[4], y: ROW2_Y, w: CARD_W, h: CARD_H, variant: 'report', title: '⑤ 리포트 작성', desc: '영역별 신뢰도·Bloom 도달도, 강점·보완·진위 종합' },
]

// 판정 다이아몬드 (decision) — 아랫줄 가운데 열
const DEC = { cx: COL[2] + CARD_W / 2, cy: ROW2_Y + CARD_H / 2, rx: CARD_W / 2, ry: CARD_H / 2 }
// 꼬리질문 카드 — 판정 아래 루프
const FU: CardNode = { id: 'fu', x: COL[2], y: 470, w: CARD_W, h: 60, variant: 'decision', title: '꼬리질문', desc: '답변에서 빠진 기준만 다시 질문' }

interface Arrow {
  d: string
  label?: string
  lx?: number
  ly?: number
}

const midY1 = ROW1_Y + CARD_H / 2
const midY2 = ROW2_Y + CARD_H / 2
const a3cx = COL[4] + CARD_W / 2
const anscx = COL[0] + CARD_W / 2

const ARROWS: Arrow[] = [
  // 윗줄 가로 화살표
  { d: `M${COL[0] + CARD_W},${midY1} H${COL[1]}` },
  { d: `M${COL[1] + CARD_W},${midY1} H${COL[2]}` },
  { d: `M${COL[2] + CARD_W},${midY1} H${COL[3]}` },
  { d: `M${COL[3] + CARD_W},${midY1} H${COL[4]}` },
  // 캐리지리턴: ③ 아래 → 왼쪽 → 답변 위로
  { d: `M${a3cx},${ROW1_Y + CARD_H} V${ROW1_Y + CARD_H + 46} H${anscx} V${ROW2_Y}` },
  // 아랫줄: 답변 → ④
  { d: `M${COL[0] + CARD_W},${midY2} H${COL[1]}` },
  // ④ → 판정(다이아 왼쪽 꼭짓점)
  { d: `M${COL[1] + CARD_W},${midY2} H${DEC.cx - DEC.rx}` },
  // 판정 → ⑤ (충분, 다이아 오른쪽 꼭짓점 → ⑤ 왼쪽)
  { d: `M${DEC.cx + DEC.rx},${midY2} H${COL[4]}`, label: '충분', lx: (DEC.cx + DEC.rx + COL[4]) / 2, ly: midY2 - 10 },
  // 판정 → 꼬리질문 (부족, 다이아 아래 꼭짓점 → 꼬리질문 위)
  { d: `M${DEC.cx},${DEC.cy + DEC.ry} V${FU.y}`, label: '부족', lx: DEC.cx + 22, ly: (DEC.cy + DEC.ry + FU.y) / 2 + 4 },
  // 꼬리질문 → 답변 (왼쪽으로 → 답변 아래로)
  { d: `M${FU.x},${FU.y + FU.h / 2} H${anscx} V${ROW2_Y + CARD_H}` },
]

function Card({ node }: { node: CardNode }) {
  return (
    <foreignObject x={node.x} y={node.y} width={node.w} height={node.h}>
      <div className={`dg-card dg-flow dg-flow-${node.variant}`}>
        {node.actor && <span className="dg-card-actor">{node.actor}</span>}
        <span className="dg-card-title">{node.title}</span>
        <span className="dg-card-desc">{node.desc}</span>
      </div>
    </foreignObject>
  )
}

export default function FlowDiagram({ className }: { className?: string }) {
  return (
    <div className={`dg-host${className ? ` ${className}` : ''}`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="동작 원리 흐름도">
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
          </marker>
        </defs>

        {ARROWS.map((a, i) => (
          <g key={i}>
            <path d={a.d} className="dg-edge" markerEnd="url(#flow-arrow)" />
            {a.label && (
              <text x={a.lx} y={a.ly} className="dg-edge-label dg-edge-label-strong" textAnchor="middle">
                {a.label}
              </text>
            )}
          </g>
        ))}

        {/* 판정 다이아몬드 */}
        <polygon
          className="dg-diamond"
          points={`${DEC.cx},${DEC.cy - DEC.ry} ${DEC.cx + DEC.rx},${DEC.cy} ${DEC.cx},${DEC.cy + DEC.ry} ${DEC.cx - DEC.rx},${DEC.cy}`}
        />
        <text x={DEC.cx} y={DEC.cy} className="dg-diamond-label" textAnchor="middle" dominantBaseline="central">
          근거 충분?
        </text>

        {CARDS.map((n) => (
          <Card key={n.id} node={n} />
        ))}
        <Card node={FU} />
      </svg>
    </div>
  )
}
