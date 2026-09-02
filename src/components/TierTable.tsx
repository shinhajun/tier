import type { CSSProperties } from 'react'
import { getReadableTextColor, type TierBoard, type TierItem } from '../lib'

function ItemTile({ item }: { item: TierItem }) {
  return (
    <li className="tier-item">
      <strong>{item.title}</strong>
      {item.note ? <span>{item.note}</span> : null}
      {item.score !== null ? (
        <b className="tier-item__score">{item.score}점</b>
      ) : null}
    </li>
  )
}

export function TierTable({ board }: { board: TierBoard }) {
  return (
    <section className="tier-table" aria-label={`${board.title} 티어표`}>
      {board.rows.map((row) => (
        <section
          className="tier-row"
          key={row.id}
          style={{
            '--tier-color': row.color,
            '--tier-foreground': getReadableTextColor(row.color),
          } as CSSProperties}
          aria-labelledby={`row-${row.id}`}
        >
          <h2 className="tier-row__label" id={`row-${row.id}`}>
            {row.label}
          </h2>
          <ul className="tier-row__items">
            {row.items.length > 0 ? (
              row.items.map((item) => <ItemTile item={item} key={item.id} />)
            ) : (
              <li className="tier-row__empty">아직 항목이 없습니다.</li>
            )}
          </ul>
        </section>
      ))}
    </section>
  )
}
