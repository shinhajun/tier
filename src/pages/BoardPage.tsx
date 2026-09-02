import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BoardEditor } from '../components/BoardEditor'
import { ArrowLeftIcon, CheckIcon, EditIcon, ShareIcon } from '../components/Icons'
import { ErrorState, LoadingState } from '../components/LoadState'
import { TierTable } from '../components/TierTable'
import { canEditBoard, getBoardBySlug, type TierBoard } from '../lib'
import { NotFoundPage } from './NotFoundPage'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value))
}

export function BoardPage() {
  const { slug = '' } = useParams()
  const [board, setBoard] = useState<TierBoard | null>(null)
  const [editable, setEditable] = useState(false)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')
  const [shareStatus, setShareStatus] = useState('')

  const loadBoard = useCallback(async () => {
    try {
      const result = await getBoardBySlug(slug)
      if (!result) {
        setStatus('missing')
        return
      }
      setBoard(result)
      setEditable(await canEditBoard(result))
      setStatus('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '티어표를 불러오지 못했습니다.')
      setStatus('error')
    }
  }, [slug])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- The route loads its remote slug after mount.
    void loadBoard()
  }, [loadBoard])

  function retry() {
    setStatus('loading')
    void loadBoard()
  }

  async function share() {
    if (!board) return
    const data = { title: board.title, text: board.description ?? `${board.title} 티어표`, url: window.location.href }
    try {
      if (navigator.share) {
        await navigator.share(data)
        setShareStatus('공유했습니다.')
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareStatus('주소를 복사했습니다.')
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setShareStatus('주소를 복사하지 못했습니다.')
    }
    window.setTimeout(() => setShareStatus(''), 2400)
  }

  if (status === 'loading') {
    return <section className="board-page page-width"><LoadingState label="티어표를 불러오는 중입니다." /></section>
  }
  if (status === 'missing') return <NotFoundPage />
  if (status === 'error') {
    return <section className="board-page page-width"><ErrorState message={error} onRetry={retry} /></section>
  }
  if (!board) return null

  if (editing) {
    return (
      <section className="board-page page-width">
        <BoardEditor
          board={board}
          onCancel={() => setEditing(false)}
          onSaved={(saved) => {
            setBoard(saved)
            setEditing(false)
          }}
        />
      </section>
    )
  }

  const itemCount = board.rows.reduce((total, row) => total + row.items.length, 0)

  return (
    <article className="board-page page-width">
      <Link className="back-link" to="/"><ArrowLeftIcon /> 공개 티어표</Link>
      <header className="board-header">
        <div className="board-header__copy">
          <p className="eyebrow">{board.category} · {board.rows.length}개 행</p>
          <h1>{board.title}</h1>
          {board.description ? <p>{board.description}</p> : null}
          <div className="board-byline">
            <span>{itemCount}개 항목</span>
            <span>업데이트 {formatDate(board.updatedAt)}</span>
            {editable ? <span className="owner-badge"><CheckIcon /> 이 브라우저에서 편집 가능</span> : null}
          </div>
        </div>
        <div className="board-header__actions">
          <button className="button button--ghost" type="button" onClick={() => void share()}>
            <ShareIcon /> 공유
          </button>
          {editable ? (
            <button className="button button--ink" type="button" onClick={() => setEditing(true)}>
              <EditIcon /> 편집
            </button>
          ) : null}
        </div>
        <span className="share-status" role="status">{shareStatus}</span>
      </header>

      <TierTable board={board} />

      <aside className="board-endnote">
        <p>{editable ? '생각이 바뀌면 언제든 이 브라우저에서 표를 다시 편집할 수 있습니다.' : '이 표는 공개된 읽기 전용 티어표입니다.'}</p>
        <Link className="text-link" to="/new">내 티어표 만들기 →</Link>
      </aside>
    </article>
  )
}
