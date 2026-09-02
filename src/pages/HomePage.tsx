import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BoardCard } from '../components/BoardCard'
import { ArrowDownIcon, PlusIcon } from '../components/Icons'
import { ErrorState, LoadingState } from '../components/LoadState'
import { isSupabaseConfigured, listPublicBoards, type BoardSummary } from '../lib'

const ALL = '전체'

function readableError(error: unknown) {
  if (!isSupabaseConfigured) {
    return '데이터베이스 연결 정보가 설정되지 않았습니다.'
  }
  return error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
}

export function HomePage() {
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  const loadBoards = useCallback(async () => {
    try {
      setBoards(await listPublicBoards())
      setStatus('ready')
    } catch (caught) {
      setError(readableError(caught))
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The route loads remote boards after mount.
    void loadBoards()
  }, [loadBoards])

  function retry() {
    setStatus('loading')
    void loadBoards()
  }

  const categories = useMemo(
    () => [ALL, ...new Set(boards.map((board) => board.category))],
    [boards],
  )
  const visibleBoards = category === ALL
    ? boards
    : boards.filter((board) => board.category === category)
  const featured = boards[0]

  return (
    <>
      <section className="home-hero page-width">
        <div className="home-hero__copy">
          <p className="eyebrow">MAKE YOUR ORDER</p>
          <h1>좋아하는 것들을,<br />내 기준대로.</h1>
          <p className="home-hero__lede">
            영화의 점수부터 음악의 순위까지. 행 이름도, 기준도 직접 정하는 가장 단순한 티어표입니다.
          </p>
          <div className="hero-actions">
            <Link className="button button--accent" to="/new">
              <PlusIcon />
              첫 티어표 만들기
            </Link>
            <a className="text-link" href="#boards">
              둘러보기
              <ArrowDownIcon />
            </a>
          </div>
        </div>
        <div className="home-hero__sample" aria-label="티어표 예시">
          <div className="sample-caption">
            <span>MY SCALE</span>
            <strong>2026</strong>
          </div>
          <div className="sample-row sample-row--red"><b>9.0</b><span>계속 생각나는 작품</span></div>
          <div className="sample-row sample-row--yellow"><b>8.0</b><span>기꺼이 다시 볼 작품</span></div>
          <div className="sample-row sample-row--blue"><b>7.0</b><span>좋았던 작품</span></div>
          <p>숫자도, 글자도, 나만의 말도 모두 행 이름이 됩니다.</p>
        </div>
      </section>

      <section className="board-section page-width" id="boards">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PUBLIC TABLES</p>
            <h2>공개 티어표</h2>
          </div>
          <p>다른 기준을 구경하고, 내 표의 시작점으로 삼아보세요.</p>
        </div>

        {status === 'loading' ? <LoadingState /> : null}
        {status === 'error' ? <ErrorState message={error} onRetry={retry} /> : null}
        {status === 'ready' ? (
          <>
            <div className="category-filter" aria-label="카테고리 필터">
              {categories.map((name) => (
                <button
                  className={category === name ? 'is-active' : ''}
                  type="button"
                  onClick={() => setCategory(name)}
                  key={name}
                  aria-pressed={category === name}
                >
                  {name}
                </button>
              ))}
            </div>

            {visibleBoards.length > 0 ? (
              <div className="board-list">
                {visibleBoards.map((board) => (
                  <BoardCard board={board} featured={board.id === featured?.id} key={board.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <h3>이 카테고리의 첫 표를 만들어 보세요.</h3>
                <Link className="text-link" to="/new">새 티어표 만들기 →</Link>
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  )
}
