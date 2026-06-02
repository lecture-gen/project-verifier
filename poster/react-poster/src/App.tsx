import { useEffect, useState } from 'react'
import ArchitectureDiagram from './components/ArchitectureDiagram'
import FlowDiagram from './components/FlowDiagram'

const RESULT_SHOTS: { file: string; caption: string }[] = [
  { file: '04_admin_console.png', caption: '① [교수자] 평가 개요 화면' },
  { file: 'interview_session.png', caption: '② [학생] 평가 진행 화면' },
  { file: 'report.png', caption: '③ [공통] 평가 리포트 화면' },
]

export default function App() {
  // 캡처/인쇄 동기화 신호. 두 다이어그램이 모두 커스텀 SVG(동기 렌더)라 마운트 직후 DOM에
  // 존재한다. 첫 페인트 뒤 준비 완료로 표시해 agent-browser 캡처/인쇄가 기다릴 수 있게 한다.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      ;(window as unknown as { __diagramsReady: boolean }).__diagramsReady = true
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="poster">
      {/* ===== HEADER (다크 + 틸 키커) ===== */}
      <header className="header">
        <div className="header-main">
          <p className="header-dept">한성대학교 · 지능시스템 캡스톤디자인</p>
          <h1 className="header-title">
            D<b>i</b>alearn
          </h1>
          <p className="header-subtitle">프로젝트 자료 분석과 LLM 기반 인터뷰로 학생의 실제 수행 여부와 이해도를 검증하는 서비스</p>
        </div>
      </header>

      <div className="stack">
        {/* 01 작품 개요 — 문제 인식 / 해결 방안 2단 */}
        <Band idx="01" title="작품 개요">
          <div className="overview-grid">
            <div className="overview-col">
              <h3 className="overview-sub">문제 인식</h3>
              <p>
                프로젝트 평가에서는 결과물 제출과 발표만으로 각 팀원이 프로젝트를 실제로 얼마나 이해하고
                있는지 확인하기 어렵다. 각 학생이 맡은 역할, 구현 과정에서의 의사결정, 문제 해결 경험이
                결과물만으로는 충분히 드러나지 않는다. 최근에는 생성형 AI의 발달로 소스 코드, 보고서,
                발표자료를 빠르게 작성할 수 있게 되면서, 학생이 직접 수행하지 않았거나 충분히 이해하지 못한
                프로젝트도 완성된 산출물처럼 보일 가능성이 커졌다. 따라서 완성된 결과물뿐만 아니라, 학생이
                프로젝트의 구조와 구현 내용을 스스로 설명할 수 있는지 확인하는 절차가 필요하다.
              </p>
            </div>
            <div className="overview-col">
              <h3 className="overview-sub">해결 방안</h3>
              <p>
                <strong>Dialearn</strong>은 학생이 제출한 프로젝트 자료(코드, 문서 등)를 근거로 인터뷰를
                진행하여 프로젝트 수행 진위를 검증하는 서비스이다. 코드와 문서를 함께 분석하여 프로젝트의
                주요 기능, 기술 스택, 아키텍처, 구현상 어려웠을 가능성이 높은 지점을 추출한다. 이후 Bloom의
                교육목표 분류와 루브릭을 기반으로 질문을 생성하고, 학생의 답변을 기반으로 학생이 실제로 이
                프로젝트를 이해했는지를 평가한다. 최종적으로 교수자는 학생이 프로젝트를 실제로 수행했는지,
                어떤 부분을 이해하고 있는지, 추가 확인이 필요한 부분은 무엇인지 리포트를 통해 확인할 수 있다.
              </p>
            </div>
          </div>
        </Band>

        {/* 02 주요 기능 — 4단 카드 */}
        <Band idx="02" title="주요 기능">
          <div className="features-grid">
            <Feature title="프로젝트 분석 및 요약">
              <p>
                학생이 제출한 ZIP 파일 또는 GitHub 저장소를 LLM을 통해 분석하여 프로젝트의 실제 코드와 문서
                내용을 파악한다. 소스 코드, README, 보고서, 발표자료, 설계 문서 등을 구분하고, 각 자료에서 프로젝트의 목적과 전체
                구조를 추출한다. 이를 바탕으로 기술 스택, 주요 기능, 아키텍처, 구현상 중요한 지점과 검증이 필요한 부분을 자동으로
                정리한다. 이 과정은 이후 질문 생성과 답변 평가가 학생이 제출한 실제 프로젝트 자료를 근거로 이루어지도록
                하는 기반이 된다.
              </p>
            </Feature>
            <Feature title="자료 기반 문제 생성">
              <p>
                분석된 프로젝트 내용을 바탕으로 LLM을 통해 학생의 이해 정도를 확인하기 위한 맞춤형 질문을
                생성한다. 질문은 Bloom's Taxonomy를 기준으로 구성되며, 내용 기억 여부를 확인하는 수준에서 끝나지
                않는다. 학생이 개념을 이해하고 있는지, 실제 구현에 적용할 수 있는지, 구조를 분석하고 설계 의도를
                평가할 수 있는지 단계적으로 확인한다. 이를 통해 프로젝트 수행 여부뿐만 아니라 학생의 인지적 이해
                수준까지 교육학적 기준에 따라 측정할 수 있다.
              </p>
            </Feature>
            <Feature title="꼬리질문">
              <p>
                학생의 답변이 부족하거나 평가 기준을 충분히 만족하지 못한 경우, LLM을 통해 루브릭 기반 꼬리질문을
                생성한다. 꼬리질문은 부족한 설명을 보완하고 더 높은 점수를 받을 기회를 제공하기 위한 기능이다.
                예를 들어 구현 근거가 부족하면 실제 코드와 연결된 설명을 유도하고,
                설계 이유가 불명확하면 의사결정 과정을 다시 설명하도록 질문한다. 이를 통해 학생의 답변을 한 번의
                응답만으로 판단하지 않고, 실제 이해도를 더 정확하게 확인할 수 있다.
              </p>
            </Feature>
            <Feature title="평가 리포트">
              <p>
                인터뷰가 종료되면 LLM을 통해 학생의 답변과 제출 자료를 종합하여 최종 평가 리포트를 생성한다.
                리포트에는 평가 요약, 이해도 점수, 질문별 평가 결과, 루브릭별 점수, Bloom 단계별 도달도가
                포함된다. 또한 학생이 잘 이해하고 있는 부분과 설명이 부족했던 부분, 자료와 답변이 일치하거나
                불일치한 지점을 함께 정리한다. 교수자는 이를 통해 학생이 프로젝트를 실제로 수행했는지, 어느
                수준까지 이해하고 있는지, 추가 확인이 필요한 부분은 무엇인지 파악할 수 있다.
              </p>
            </Feature>
          </div>
        </Band>

        {/* 03 시스템 구조 + 04 동작 원리 — 다이어그램 밴드(잔여 높이 흡수) */}
        <section className="band flex">
          <div className="diagram-band" style={{ flex: '1 1 0', minHeight: 0 }}>
            <div className="diagram-col">
              <BandHead idx="03" title="시스템 구조" />
              <div className="dg-wrap">
                <ArchitectureDiagram />
              </div>
            </div>
            <div className="diagram-col">
              <BandHead idx="04" title="동작 원리" />
              <div className="dg-wrap">
                <FlowDiagram />
              </div>
            </div>
          </div>
        </section>

        {/* 05 결과물 — 3칸 */}
        <Band idx="05" title="결과물">
          <div className="result-shots">
            {RESULT_SHOTS.map(({ file, caption }) => (
              <ResultShot key={file} file={file} caption={caption} />
            ))}
          </div>
        </Band>

        {/* 06 기대 효과 — 3칸(상단 틸 보더) */}
        <Band idx="06" title="기대 효과" last>
          <div className="impact-grid">
            <Impact title="프로젝트 평가의 신뢰도 향상">
              Dialearn은 제출된 결과물과 학생 답변을 함께 검증하기 때문에, 산출물만으로 판단하기 어려운 실제
              수행 여부를 확인할 수 있다. 학생이 프로젝트의 구조, 구현 방식, 설계 의도, 문제 해결 과정을 직접
              설명해야 하므로 결과물 제출 중심 평가보다 진정성 검증에 유리하다. 또한 동일한 질문 생성 기준과
              루브릭을 적용하여 평가자의 주관적 판단을 줄이고 보다 일관된 평가를 지원한다.
            </Impact>
            <Impact title="교수자의 평가 부담 감소">
              교수자는 모든 코드와 문서를 처음부터 직접 검토하지 않아도, LLM이 정리한 프로젝트 분석 결과와
              학생별 검증 리포트를 통해 핵심 내용을 빠르게 확인할 수 있다. 질문 생성, 인터뷰 기록, 답변 평가,
              리포트 정리가 자동화되기 때문에 여러 팀과 여러 학생을 평가해야 하는 프로젝트 평가에서 반복적인
              확인 업무를 줄일 수 있다. 이를 통해 교수자는 결과물 검토에 소요되는 시간을 줄이고, 최종 판단과
              피드백 제공에 더 집중할 수 있다.
            </Impact>
            <Impact title="학생 피드백 품질 개선">
              학생은 최종 리포트를 통해 자신이 어떤 영역을 잘 이해하고 있는지, 어떤 부분에서 설명이 부족했는지
              구체적으로 확인할 수 있다. 리포트는 점수만 전달하는 방식에서 벗어나 질문별 평가와 영역별 분석을
              제공하므로, 학생이 프로젝트를 되돌아보고 개선 방향을 파악하는 데 도움이 된다. 교수자는 이 결과를
              바탕으로 학생에게 더 구체적이고 근거 있는 피드백을 제공할 수 있다.
            </Impact>
          </div>
        </Band>
      </div>

      {/* ===== FOOTER (다크 한 줄 바) ===== */}
      <footer className="footer">
        <div className="footer-team">
          <span className="footer-label">지도교수 · 팀원</span>
          <span>
            <b>지준</b> 교수님 · <b>이강혁</b> 백엔드·인프라 · <b>신준성</b> 프론트엔드 · <b>황현석</b> AI
          </span>
        </div>
      </footer>
    </div>
  )
}

/** 번호 배지 + 제목 + 우측 라인. */
function BandHead({ idx, title }: { idx: string; title: string }) {
  return (
    <div className="band-head">
      <span className="idx">{idx}</span>
      <h2>{title}</h2>
      <span className="rule"></span>
    </div>
  )
}

/** 가로 밴드(헤더 포함). `last`면 하단 구분선을 제거한다. */
function Band({
  idx,
  title,
  children,
  last,
}: {
  idx: string
  title: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <section className="band" style={last ? { borderBottom: 'none' } : undefined}>
      <BandHead idx={idx} title={title} />
      {children}
    </section>
  )
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="feature">
      <h3 className="feature-title">{title}</h3>
      {children}
    </div>
  )
}

/**
 * 결과물 스크린샷 한 칸. 이미지가 아직 없으면(준비 중) 깨진 이미지 대신
 * 플레이스홀더를 보여 준다. interview_session.png · report.png 는 사용자가 직접 채운다.
 */
function ResultShot({ file, caption }: { file: string; caption: string }) {
  const [missing, setMissing] = useState(false)
  return (
    <figure className="result-shot">
      {missing ? (
        <div className="result-shot-placeholder">스크린샷 준비 중</div>
      ) : (
        <img src={`/screenshots/${file}`} alt={caption} onError={() => setMissing(true)} />
      )}
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

function Impact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="impact">
      <h3 className="impact-item-title">{title}</h3>
      <p>{children}</p>
    </article>
  )
}
