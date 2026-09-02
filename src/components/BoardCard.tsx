import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getReadableTextColor, type BoardSummary } from '../lib'

export function BoardCard({ board, featured = false }: { board: BoardSummary; featured?: boolean }) {
  return (
    <Link className={`board-card${featured ? ' board-card--featured' : ''}`} to={`/t/${board.slug}`}>
      <div className="board-card__meta">
        <span>{board.category}</span>
        <span>{board.itemCount}개 항목</span>
      </div>
      <h3>{board.title}</h3>
      {board.description ? <p>{board.description}</p> : null}
      <div className="board-card__rows" aria-hidden="true">
        {board.rows.slice(0, 4).map((row) => (
          <span
            key={row.id}
            style={{
              '--row-color': row.color,
              '--row-foreground': getReadableTextColor(row.color),
            } as CSSProperties}
          >
            <b>{row.label}</b>
            <i>{row.items.join(' · ') || '—'}</i>
          </span>
        ))}
      </div>
      <span className="board-card__open">티어표 보기 →</span>
    </Link>
  )
}
