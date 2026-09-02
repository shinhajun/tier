import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BoardCard } from '../components/BoardCard'
import { PlusIcon } from '../components/Icons'
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
  return (
    <section className="home-page page-width">
      <header className="home-toolbar">
        <div>
          <h1>티어표</h1>
          {status === 'ready' ? <span>{boards.length}개</span> : null}
        </div>
        <Link className="button button--ink" to="/new"><PlusIcon /> 새 티어표</Link>
      </header>

      {status === 'loading' ? <LoadingState /> : null}
      {status === 'error' ? <ErrorState message={error} onRetry={retry} /> : null}
      {status === 'ready' ? (
        <>
          {categories.length > 2 ? (
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
          ) : null}

          {visibleBoards.length > 0 ? (
            <div className="board-list">
              {visibleBoards.map((board) => <BoardCard board={board} key={board.id} />)}
            </div>
          ) : (
            <div className="empty-state">
              <p>표가 없습니다.</p>
              <Link className="text-link" to="/new">새 티어표 만들기</Link>
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
