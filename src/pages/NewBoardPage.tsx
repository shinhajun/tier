import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { TurnstileGate } from '../components/TurnstileGate'
import { BOARD_LIMITS, createBoard, type BoardDraft, type RowDraft } from '../lib'

const COLORS = ['#E26645', '#E9B949', '#A8B66B', '#5B9F8C', '#668DB8', '#8A78A8', '#8D8D86']

const templates: Array<{ id: string; name: string; description: string; labels: string[] }> = [
  { id: 'score', name: '점수형', description: '10점부터 6점까지', labels: ['10점', '9점', '8점', '7.5점', '7점', '6점'] },
  { id: 'tier', name: '기본형', description: 'SS부터 D까지', labels: ['SS', 'S', 'A', 'B', 'C', 'D'] },
  { id: 'words', name: '말로 표현', description: '최고부터 아쉬움까지', labels: ['최고', '좋음', '보통', '아쉬움'] },
]

function rowsFrom(labels: string[]): RowDraft[] {
  return labels.map((label, index) => ({
    id: crypto.randomUUID(),
    label,
    color: COLORS[index % COLORS.length],
    position: index,
    items: [],
  }))
}

const initialDraft: BoardDraft = {
  title: '',
  category: '영화',
  description: null,
  isPublic: true,
  rows: rowsFrom(templates[0].labels),
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function NewBoardPage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<BoardDraft>(initialDraft)
  const [selectedTemplate, setSelectedTemplate] = useState('score')
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaResetKey, setCaptchaResetKey] = useState(0)
  const handleCaptchaToken = useCallback((token: string | null) => setCaptchaToken(token), [])

  const isValid = useMemo(
    () => draft.title.trim().length >= 2 && draft.rows.length >= 2 && draft.rows.every((row) => row.label.trim()),
    [draft],
  )

  function applyTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    setSelectedTemplate(templateId)
    setDraft((current) => ({ ...current, rows: rowsFrom(template.labels) }))
  }

  function updateRow(index: number, patch: Partial<RowDraft>) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    }))
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= draft.rows.length) return
    setDraft((current) => ({ ...current, rows: move(current.rows, index, target) }))
  }

  function removeRow(index: number) {
    if (draft.rows.length <= 2) return
    setDraft((current) => ({ ...current, rows: current.rows.filter((_, rowIndex) => rowIndex !== index) }))
    setSelectedTemplate('custom')
  }

  function addRow() {
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          id: crypto.randomUUID(),
          label: `새 행 ${current.rows.length + 1}`,
          color: COLORS[current.rows.length % COLORS.length],
          position: current.rows.length,
          items: [],
        },
      ],
    }))
    setSelectedTemplate('custom')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid || !captchaToken || status === 'saving') return
    setStatus('saving')
    setError('')
    try {
      const board = await createBoard(draft, captchaToken)
      navigate(`/t/${board.slug}`, { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '티어표를 저장하지 못했습니다.')
      setStatus('error')
      setCaptchaToken(null)
      setCaptchaResetKey((current) => current + 1)
    }
  }

  return (
    <section className="creator page-width page-width--narrow">
      <Link className="back-link" to="/"><ArrowLeftIcon /> 둘러보기</Link>
      <header className="creator__header">
        <p className="eyebrow">NEW TABLE</p>
        <h1>새 티어표</h1>
        <p>먼저 기준이 될 행을 정하세요. 항목은 표를 만든 다음 차분히 채울 수 있습니다.</p>
      </header>

      <form className="creator-form" onSubmit={submit}>
        <fieldset className="form-section">
          <legend><span>01</span> 표의 이름</legend>
          <div className="form-grid form-grid--title">
            <label className="field">
              <span>제목</span>
              <input
                required
                minLength={2}
                maxLength={BOARD_LIMITS.title}
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="예: 내가 좋아하는 SF 영화"
              />
            </label>
            <label className="field">
              <span>카테고리</span>
              <input
                required
                maxLength={BOARD_LIMITS.category}
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                placeholder="영화, 음악, 게임…"
              />
            </label>
          </div>
          <label className="field">
            <span>한 줄 설명 <small>선택</small></span>
            <textarea
              maxLength={BOARD_LIMITS.description}
              value={draft.description ?? ''}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              placeholder="어떤 기준으로 나눈 표인지 적어보세요."
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend><span>02</span> 행 구성</legend>
          <div className="template-list">
            {templates.map((template) => (
              <button
                className={selectedTemplate === template.id ? 'is-active' : ''}
                type="button"
                onClick={() => applyTemplate(template.id)}
                key={template.id}
                aria-pressed={selectedTemplate === template.id}
              >
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>

          <div className="row-setup" aria-label="티어 행 편집">
            {draft.rows.map((row, index) => (
              <div className="row-setup__item" key={row.id}>
                <input
                  className="color-input"
                  type="color"
                  value={row.color}
                  onChange={(event) => updateRow(index, { color: event.target.value })}
                  aria-label={`${index + 1}번째 행 색상`}
                />
                <label className="field field--inline">
                  <span className="visually-hidden">{index + 1}번째 행 이름</span>
                  <input
                    required
                    maxLength={BOARD_LIMITS.rowLabel}
                    value={row.label}
                    onChange={(event) => {
                      updateRow(index, { label: event.target.value })
                      setSelectedTemplate('custom')
                    }}
                  />
                </label>
                <div className="icon-actions">
                  <button type="button" onClick={() => moveRow(index, -1)} disabled={index === 0} aria-label={`${row.label} 위로 이동`}><ArrowUpIcon /></button>
                  <button type="button" onClick={() => moveRow(index, 1)} disabled={index === draft.rows.length - 1} aria-label={`${row.label} 아래로 이동`}><ArrowDownIcon /></button>
                  <button type="button" onClick={() => removeRow(index)} disabled={draft.rows.length <= 2} aria-label={`${row.label} 삭제`}><TrashIcon /></button>
                </div>
              </div>
            ))}
          </div>
          <button className="add-row-button" type="button" onClick={addRow} disabled={draft.rows.length >= BOARD_LIMITS.rows}>
            <PlusIcon /> 행 추가
          </button>
        </fieldset>

        <div className="ownership-note">
          <strong>로그인 없이 바로 시작합니다.</strong>
          <p>이 브라우저에 익명 편집 권한이 저장됩니다. 브라우저 데이터를 지우면 편집할 수 없으니, 완성한 표의 주소를 따로 보관해 주세요.</p>
        </div>

        <div className="captcha-section">
          <div>
            <strong>보안 확인</strong>
            <p>자동 생성을 막기 위한 한 번의 확인입니다.</p>
          </div>
          <TurnstileGate key={captchaResetKey} onToken={handleCaptchaToken} />
        </div>

        {status === 'error' ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="form-submit">
          <Link className="button button--ghost" to="/">취소</Link>
          <button className="button button--accent" type="submit" disabled={!isValid || !captchaToken || status === 'saving'}>
            {status === 'saving' ? '만드는 중…' : '티어표 만들기'}
          </button>
        </div>
      </form>
    </section>
  )
}
