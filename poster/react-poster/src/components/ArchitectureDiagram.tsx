/**
 * 다이어그램 1. 시스템 구조 — 커스텀 SVG (제품 로고 + 중첩 경계 박스)
 *
 * 실제 배포 토폴로지를 담는다: 사용자 브라우저 → Oracle Cloud VM(리버스 프록시 + Docker Compose
 * 3 컨테이너) → 외부 OpenAI API. mermaid architecture-beta 를 대체하며, "동작 원리"(FlowDiagram)와
 * 같은 방식으로 viewBox SVG + foreignObject 카드 + path 화살표로 그린다. 포트 번호는 표기하지 않고
 * 컴포넌트명·역할 위주로 둔다.
 *
 *   사용자(브라우저) ─HTTPS(dialearn.presso.ac)─▶ [Oracle Cloud VM
 *       리버스 프록시(nginx·TLS) ─▶ [Docker Compose  Next.js 웹 ↔ FastAPI ─▶ Qdrant · SQLite ]]
 *   FastAPI ─HTTPS─▶ 외부 OpenAI API
 *
 * 로고는 src/components/logos.ts(@iconify-json/logos 추출)에서 인라인. 색/폰트 토큰은 poster.css.
 */
import { Logo, type LogoName } from './logos'

const VIEW_W = 1000
const VIEW_H = 436

type Variant = 'client' | 'proxy' | 'web' | 'api' | 'qdrant' | 'sqlite' | 'external'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface CardNode extends Box {
  id: string
  variant: Variant
  logo: LogoName
  actor?: string
  title: string
  desc: string
}

// ── 경계 박스(zone) ──
const ORACLE: Box = { x: 186, y: 16, w: 608, h: 406 }
const DOCKER: Box = { x: 344, y: 54, w: 430, h: 352 }

// ── 컴포넌트 카드 ──
const CARDS: CardNode[] = [
  { id: 'browser', x: 4, y: 86, w: 166, h: 128, variant: 'client', logo: 'chrome', actor: '사용자', title: '브라우저', desc: '' },
  { id: 'proxy', x: 206, y: 86, w: 122, h: 128, variant: 'proxy', logo: 'nginx', title: '리버스 프록시', desc: '' },
  { id: 'web', x: 360, y: 86, w: 184, h: 128, variant: 'web', logo: 'nextjs', title: 'Next.js 웹', desc: '' },
  { id: 'api', x: 576, y: 86, w: 184, h: 128, variant: 'api', logo: 'fastapi', title: 'FastAPI 백엔드', desc: '' },
  { id: 'qdrant', x: 360, y: 250, w: 184, h: 128, variant: 'qdrant', logo: 'qdrant', title: 'Qdrant 벡터DB', desc: '임베딩 유사도 검색' },
  { id: 'sqlite', x: 576, y: 250, w: 184, h: 128, variant: 'sqlite', logo: 'sqlite', title: 'SQLite', desc: '' },
  { id: 'openai', x: 800, y: 168, w: 196, h: 128, variant: 'external', logo: 'openai', actor: '외부', title: 'OpenAI API', desc: 'gpt-4o-mini · text-embedding-3-small' },
]

const card = (id: string): CardNode => CARDS.find((c) => c.id === id)!

interface Edge {
  d: string
  label?: string
  lx?: number
  ly?: number
}

const cx = (b: Box) => b.x + b.w / 2
const cy = (b: Box) => b.y + b.h / 2

const browser = card('browser')
const proxy = card('proxy')
const web = card('web')
const api = card('api')
const qdrant = card('qdrant')
const sqlite = card('sqlite')
const openai = card('openai')

const EDGES: Edge[] = [
  // 브라우저 → 리버스 프록시 (HTTPS, Oracle 경계 횡단)
  { d: `M${browser.x + browser.w},${cy(browser)} H${proxy.x}`, label: 'HTTPS', lx: (browser.x + browser.w + proxy.x) / 2, ly: cy(browser) - 9 },
  // 리버스 프록시 → Next.js 웹
  { d: `M${proxy.x + proxy.w},${cy(proxy)} H${(proxy.x + proxy.w + web.x) / 2} V${cy(web)} H${web.x}` },
  // Next.js 웹 ↔ FastAPI (내부 통신)
  { d: `M${web.x + web.w},${cy(web)} H${api.x}`, lx: (web.x + web.w + api.x) / 2, ly: cy(web) - 9 },
  // FastAPI → Qdrant
  { d: `M${cx(api)},${api.y + api.h} V${(api.y + api.h + qdrant.y) / 2} H${cx(qdrant)} V${qdrant.y}` },
  // FastAPI → SQLite
  { d: `M${cx(api)},${api.y + api.h} V${sqlite.y}` },
  // FastAPI → OpenAI (HTTPS, Oracle 경계 횡단)
  { d: `M${api.x + api.w},${cy(api)} H${ORACLE.x + ORACLE.w - 6} V${cy(openai)} H${openai.x}`, label: 'HTTPS', lx: (api.x + api.w + openai.x) / 2 + 8, ly: cy(api) - 9 },
]

function Card({ node }: { node: CardNode }) {
  return (
    <foreignObject x={node.x} y={node.y} width={node.w} height={node.h}>
      <div className={`dg-card dg-arch dg-arch-${node.variant}`}>
        <div className="dg-card-head">
          <Logo name={node.logo} size={26} />
          {node.actor && <span className="dg-card-actor">{node.actor}</span>}
        </div>
        <span className="dg-card-title">{node.title}</span>
        <span className="dg-card-desc">{node.desc}</span>
      </div>
    </foreignObject>
  )
}

function Zone({ box, variant, logo, label }: { box: Box; variant: string; logo: LogoName; label: string }) {
  return (
    <g>
      <rect className={`dg-zone dg-zone-${variant}`} x={box.x} y={box.y} width={box.w} height={box.h} rx={14} />
      <foreignObject x={box.x + 12} y={box.y + 8} width={box.w - 24} height={32}>
        <div className={`dg-zone-label dg-zone-label-${variant}`}>
          <Logo name={logo} size={18} />
          <span>{label}</span>
        </div>
      </foreignObject>
    </g>
  )
}

export default function ArchitectureDiagram({ className }: { className?: string }) {
  return (
    <div className={`dg-host${className ? ` ${className}` : ''}`}>
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="시스템 구조도">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
          </marker>
        </defs>

        {/* 경계 박스: Oracle Cloud VM > Docker Compose */}
        <Zone box={ORACLE} variant="oracle" logo="oracle" label="Cloud VM (호스트)" />
        <Zone box={DOCKER} variant="docker" logo="docker" label="Docker Compose" />

        {/* 엣지 */}
        {EDGES.map((e, i) => (
          <g key={i}>
            <path d={e.d} className="dg-edge" markerEnd="url(#arch-arrow)" />
            {e.label && (
              <text x={e.lx} y={e.ly} className="dg-edge-label" textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        ))}

        {/* 카드 */}
        {CARDS.map((n) => (
          <Card key={n.id} node={n} />
        ))}
      </svg>
    </div>
  )
}
