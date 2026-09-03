import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashIcon,
} from './Icons'
import {
  BOARD_LIMITS,
  BoardValidationError,
  deleteBoard,
  isValidTierScore,
  saveBoard,
  validateBoardDraft,
  type TierBoard,
  type TierItem,
  type TierRow,
} from '../lib'

const ROW_COLORS = ['#E26645', '#E9B949', '#A8B66B', '#5B9F8C', '#668DB8', '#8A78A8', '#8D8D86']

function reorder<T>(list: T[], from: number, to: number) {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

interface BoardEditorProps {
  board: TierBoard
  onCancel: () => void
  onDeleted?: () => void
  onSaved: (board: TierBoard) => void
}

export function BoardEditor({ board, onCancel, onDeleted, onSaved }: BoardEditorProps) {
  const [draft, setDraft] = useState<TierBoard>(() => structuredClone(board))
  const [newTitle, setNewTitle] = useState('')
  const [newScore, setNewScore] = useState('')
  const [addingRowId, setAddingRowId] = useState<string | null>(null)
  const [quickAddError, setQuickAddError] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting' | 'error'>('idle')
  const [error, setError] = useState('')

  const itemCount = draft.rows.reduce((total, row) => total + row.items.length, 0)
  const validationMessage = useMemo(() => {
    try {
      validateBoardDraft(draft)
      return draft.rows.length >= 2 ? '' : '행은 두 개 이상 유지해 주세요.'
    } catch (caught) {
      if (caught instanceof BoardValidationError) return caught.issues[0]
      throw caught
    }
  }, [draft])
  const isValid = validationMessage === ''

  function setRows(updater: (rows: TierRow[]) => TierRow[]) {
    setDraft((current) => ({ ...current, rows: updater(current.rows) }))
  }

  function updateRow(rowIndex: number, patch: Partial<TierRow>) {
    setRows((rows) => rows.map((row, index) => index === rowIndex ? { ...row, ...patch } : row))
  }

  function moveRow(rowIndex: number, direction: -1 | 1) {
    const target = rowIndex + direction
    if (target < 0 || target >= draft.rows.length) return
    setRows((rows) => reorder(rows, rowIndex, target))
  }

  function removeRow(rowIndex: number) {
    if (draft.rows.length <= 2) return
    const row = draft.rows[rowIndex]
    const targetIndex = rowIndex === draft.rows.length - 1 ? rowIndex - 1 : rowIndex + 1
    const target = draft.rows[targetIndex]
    if (!window.confirm(`‘${row.label}’ 행을 지울까요? 포함된 항목은 ‘${target.label}’ 행으로 옮깁니다.`)) return

    setRows((rows) => {
      const targetId = rows[targetIndex].id
      const movedItems = rows[rowIndex].items
      return rows
        .filter((_, index) => index !== rowIndex)
        .map((current) => current.id === targetId
          ? { ...current, items: [...current.items, ...movedItems] }
          : current)
    })
    if (addingRowId === row.id) setAddingRowId(target.id)
  }

  function addRow() {
    const id = crypto.randomUUID()
    setRows((rows) => [
      ...rows,
      {
        id,
        label: `새 행 ${rows.length + 1}`,
        color: ROW_COLORS[rows.length % ROW_COLORS.length],
        position: rows.length,
        items: [],
      },
    ])
    setAddingRowId(id)
    setNewTitle('')
    setNewScore('')
    setQuickAddError('')
  }

  function updateItem(rowIndex: number, itemIndex: number, patch: Partial<TierItem>) {
    setRows((rows) => rows.map((row, index) => index === rowIndex
      ? { ...row, items: row.items.map((item, currentIndex) => currentIndex === itemIndex ? { ...item, ...patch } : item) }
      : row))
  }

  function moveItem(rowIndex: number, itemIndex: number, direction: -1 | 1) {
    const row = draft.rows[rowIndex]
    const target = itemIndex + direction
    if (target < 0 || target >= row.items.length) return
    updateRow(rowIndex, { items: reorder(row.items, itemIndex, target) })
  }

  function relocateItem(rowIndex: number, itemIndex: number, targetRowId: string) {
    const item = draft.rows[rowIndex].items[itemIndex]
    if (draft.rows[rowIndex].id === targetRowId) return
    setRows((rows) => rows.map((row, index) => {
      if (index === rowIndex) return { ...row, items: row.items.filter((_, current) => current !== itemIndex) }
      if (row.id === targetRowId) return { ...row, items: [...row.items, item] }
      return row
    }))
  }

  function removeItem(rowIndex: number, itemIndex: number) {
    const title = draft.rows[rowIndex].items[itemIndex].title
    if (!window.confirm(`‘${title}’ 항목을 지울까요?`)) return
    updateRow(rowIndex, { items: draft.rows[rowIndex].items.filter((_, index) => index !== itemIndex) })
  }

  function addItem() {
    const title = newTitle.trim()
    if (!title || !addingRowId || itemCount >= BOARD_LIMITS.items) return
    const numericScore = newScore.trim() === '' ? null : Number(newScore)
    if (numericScore !== null && !isValidTierScore(numericScore)) {
      setQuickAddError('점수는 0~10 사이에서 0.1 단위로 입력해 주세요.')
      return
    }
    const item: TierItem = {
      id: crypto.randomUUID(),
      title,
      note: null,
      score: numericScore,
      position: 0,
    }
    setRows((rows) => rows.map((row) => row.id === addingRowId
      ? { ...row, items: [...row.items, { ...item, position: row.items.length }] }
      : row))
    setNewTitle('')
    setNewScore('')
    setQuickAddError('')
  }

  function toggleItemCreator(rowId: string) {
    setAddingRowId((current) => current === rowId ? null : rowId)
    setNewTitle('')
    setNewScore('')
    setQuickAddError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid || status === 'saving') return
    setStatus('saving')
    setError('')
    try {
      onSaved(await saveBoard(draft))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '변경 내용을 저장하지 못했습니다.')
      setStatus('error')
    }
  }

  async function removeBoard() {
    if (status === 'saving' || status === 'deleting') return
    if (!window.confirm(`‘${draft.title}’ 티어표를 삭제할까요?`)) return
    setStatus('deleting')
    setError('')
    try {
      await deleteBoard(draft)
      onDeleted?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '티어표를 삭제하지 못했습니다.')
      setStatus('error')
    }
  }

  return (
    <form className="board-editor" onSubmit={submit}>
      <div className="editor-intro">
        <h2>티어표 수정</h2>
        <span>{itemCount}개 항목 · {draft.rows.length}개 행</span>
      </div>

      <div className="editor-meta">
        <label className="field">
          <span>제목</span>
          <input value={draft.title} maxLength={BOARD_LIMITS.title} required onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label className="field">
          <span>카테고리</span>
          <input value={draft.category} maxLength={BOARD_LIMITS.category} required onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
        </label>
        <label className="field editor-meta__description">
          <span>설명 <small>선택</small></span>
          <textarea rows={2} maxLength={BOARD_LIMITS.description} value={draft.description ?? ''} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>
      </div>

      <div className="editor-rows__toolbar">
        <h3>행과 항목</h3>
        <button
          className="add-row-button"
          type="button"
          onClick={addRow}
          disabled={draft.rows.length >= BOARD_LIMITS.rows}
          aria-label="새 행 만들기"
        >
          <PlusIcon /> 새 행
        </button>
      </div>

      <div className="editor-rows">
        {draft.rows.map((row, rowIndex) => (
          <section className="editor-row" key={row.id} style={{ '--tier-color': row.color } as CSSProperties}>
            <header className="editor-row__header">
              <input className="color-input" type="color" value={row.color} onChange={(event) => updateRow(rowIndex, { color: event.target.value })} aria-label={`${row.label} 행 색상`} />
              <label className="field field--inline">
                <span className="visually-hidden">행 이름</span>
                <input required maxLength={BOARD_LIMITS.rowLabel} value={row.label} onChange={(event) => updateRow(rowIndex, { label: event.target.value })} />
              </label>
              <button
                className="row-add-button"
                type="button"
                onClick={() => toggleItemCreator(row.id)}
                disabled={itemCount >= BOARD_LIMITS.items}
                aria-expanded={addingRowId === row.id}
                aria-label={`${row.label}에 항목 추가`}
              >
                <PlusIcon /> 항목 추가
              </button>
              <div className="icon-actions">
                <button type="button" onClick={() => moveRow(rowIndex, -1)} disabled={rowIndex === 0} aria-label={`${row.label} 위로 이동`}><ArrowUpIcon /></button>
                <button type="button" onClick={() => moveRow(rowIndex, 1)} disabled={rowIndex === draft.rows.length - 1} aria-label={`${row.label} 아래로 이동`}><ArrowDownIcon /></button>
                <button type="button" onClick={() => removeRow(rowIndex)} disabled={draft.rows.length <= 2} aria-label={`${row.label} 삭제`}><TrashIcon /></button>
              </div>
            </header>

            {addingRowId === row.id ? (
              <div className="row-item-creator" role="group" aria-label={`${row.label} 새 항목`}>
                <label className="field">
                  <span className="visually-hidden">새 항목 이름</span>
                  <input
                    value={newTitle}
                    maxLength={BOARD_LIMITS.itemTitle}
                    onChange={(event) => {
                      setNewTitle(event.target.value)
                      setQuickAddError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addItem()
                      }
                    }}
                    placeholder="새 항목 이름"
                  />
                </label>
                <label className="field field--score">
                  <span className="visually-hidden">새 항목 점수</span>
                  <input
                    value={newScore}
                    onChange={(event) => {
                      setNewScore(event.target.value)
                      setQuickAddError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addItem()
                      }
                    }}
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    aria-describedby={quickAddError ? `quick-add-error-${row.id}` : undefined}
                    placeholder="점수"
                  />
                </label>
                <div className="row-item-creator__actions">
                  <button className="button button--ghost" type="button" onClick={() => toggleItemCreator(row.id)}>닫기</button>
                  <button
                    className="button button--ink"
                    type="button"
                    onClick={addItem}
                    disabled={!newTitle.trim() || (newScore.trim() !== '' && !isValidTierScore(Number(newScore)))}
                    aria-label={`${row.label}에 추가`}
                  >
                    추가
                  </button>
                </div>
                {quickAddError ? <p className="form-error" id={`quick-add-error-${row.id}`} role="alert">{quickAddError}</p> : null}
              </div>
            ) : null}

            <div className="editor-items">
              {row.items.map((item, itemIndex) => (
                <article className="editor-item" key={item.id}>
                  <div className="editor-item__main">
                    <label className="field">
                      <span>항목</span>
                      <input required maxLength={BOARD_LIMITS.itemTitle} value={item.title} onChange={(event) => updateItem(rowIndex, itemIndex, { title: event.target.value })} />
                    </label>
                    <label className="field field--score">
                      <span>점수</span>
                      <input type="number" min="0" max="10" step="0.1" value={item.score ?? ''} onChange={(event) => updateItem(rowIndex, itemIndex, { score: event.target.value === '' ? null : Number(event.target.value) })} />
                    </label>
                  </div>
                  <label className="field">
                    <span>메모 <small>선택</small></span>
                    <input maxLength={BOARD_LIMITS.itemNote} value={item.note ?? ''} onChange={(event) => updateItem(rowIndex, itemIndex, { note: event.target.value || null })} placeholder="짧은 이유나 연도" />
                  </label>
                  <div className="editor-item__footer">
                    <label>
                      <span>행 이동</span>
                      <select value={row.id} onChange={(event) => relocateItem(rowIndex, itemIndex, event.target.value)}>
                        {draft.rows.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="icon-actions">
                      <button type="button" onClick={() => moveItem(rowIndex, itemIndex, -1)} disabled={itemIndex === 0} aria-label={`${item.title} 앞으로 이동`}><ArrowUpIcon /></button>
                      <button type="button" onClick={() => moveItem(rowIndex, itemIndex, 1)} disabled={itemIndex === row.items.length - 1} aria-label={`${item.title} 뒤로 이동`}><ArrowDownIcon /></button>
                      <button type="button" onClick={() => removeItem(rowIndex, itemIndex)} aria-label={`${item.title} 삭제`}><TrashIcon /></button>
                    </div>
                  </div>
                </article>
              ))}
              {row.items.length === 0 ? <p className="editor-row__empty">항목 추가를 눌러 첫 항목을 만드세요.</p> : null}
            </div>
          </section>
        ))}
      </div>

      {validationMessage ? <p className="form-error" role="alert">{validationMessage}</p> : null}
      {status === 'error' ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="editor-actions">
        <button className="button button--danger" type="button" onClick={() => void removeBoard()} disabled={status === 'saving' || status === 'deleting'}>
          {status === 'deleting' ? '삭제 중…' : '티어표 삭제'}
        </button>
        <div>
          <button className="button button--ghost" type="button" onClick={onCancel}>취소</button>
          <button className="button button--ink" type="submit" disabled={!isValid || status === 'saving' || status === 'deleting'}>
            {status === 'saving' ? '저장하는 중…' : '변경 내용 저장'}
          </button>
        </div>
      </div>
    </form>
  )
}
