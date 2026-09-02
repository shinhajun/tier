import { Link } from 'react-router-dom'
import type { BoardSummary } from '../lib'

export function BoardCard({ board }: { board: BoardSummary }) {
  return (
    <Link className="board-card" to={`/t/${board.slug}`}>
      <div>
        <span className="board-card__meta">{board.category} · {board.itemCount}개</span>
        <h2>{board.title}</h2>
        {board.description ? <p>{board.description}</p> : null}
      </div>
      <span className="board-card__open" aria-hidden="true">→</span>
    </Link>
  )
}
