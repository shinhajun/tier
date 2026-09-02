import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BoardEditor } from '../components/BoardEditor'
import { ArrowLeftIcon, EditIcon, ShareIcon } from '../components/Icons'
import { ErrorState, LoadingState } from '../components/LoadState'
import { TierTable } from '../components/TierTable'
import { canEditBoard, getBoardBySlug, unlockAdminEditing, type TierBoard } from '../lib'
import { NotFoundPage } from './NotFoundPage'

export function BoardPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [board, setBoard] = useState<TierBoard | null>(null)
  const [editable, setEditable] = useState(false)
  const [editing, setEditing] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [unlockStatus, setUnlockStatus] = useState<'idle' | 'checking'>('idle')
  const [unlockError, setUnlockError] = useState('')
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

  function requestEdit() {
    if (editable) {
      setEditing(true)
      return
    }
    setUnlocking(true)
    setUnlockError('')
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (unlockStatus === 'checking') return
    setUnlockStatus('checking')
    setUnlockError('')
    try {
      await unlockAdminEditing(adminKey)
      setEditable(true)
      setUnlocking(false)
      setEditing(true)
      setAdminKey('')
    } catch (caught) {
      setUnlockError(caught instanceof Error ? caught.message : '편집 잠금을 해제하지 못했습니다.')
    } finally {
      setUnlockStatus('idle')
    }
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
          onDeleted={() => navigate('/', { replace: true })}
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
      <Link className="back-link" to="/"><ArrowLeftIcon /> 티어표</Link>
      <header className="board-header">
        <div className="board-header__copy">
          <p className="board-meta">{board.category} · {board.rows.length}개 행 · {itemCount}개 항목</p>
          <h1>{board.title}</h1>
          {board.description ? <p>{board.description}</p> : null}
        </div>
        <div className="board-header__actions">
          <button className="button button--ghost" type="button" onClick={() => void share()}>
            <ShareIcon /> 공유
          </button>
          <button className="button button--ink" type="button" onClick={requestEdit}>
            <EditIcon /> 수정
          </button>
        </div>
        <span className="share-status" role="status">{shareStatus}</span>
      </header>

      {unlocking ? (
        <form className="edit-unlock" onSubmit={unlock}>
          <label className="field">
            <span>관리자 키</span>
            <input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
            />
          </label>
          <div className="edit-unlock__actions">
            <button className="button button--ghost" type="button" onClick={() => setUnlocking(false)}>취소</button>
            <button className="button button--ink" type="submit" disabled={!adminKey.trim() || unlockStatus === 'checking'}>
              {unlockStatus === 'checking' ? '확인 중…' : '잠금 해제'}
            </button>
          </div>
          {unlockError ? <p className="form-error" role="alert">{unlockError}</p> : null}
        </form>
      ) : null}

      <TierTable board={board} />
    </article>
  )
}
