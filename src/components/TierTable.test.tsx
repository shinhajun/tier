import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { TierBoard } from '../lib'
import { TierTable } from './TierTable'

const movieBoard: TierBoard = {
  id: 'movies',
  slug: 'sf-movies',
  title: 'SF 영화 티어표',
  category: '영화',
  description: '개인 평점',
  ownerId: 'owner',
  isPublic: true,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  rows: [
    {
      id: 'nine', label: '9점', color: '#E26645', position: 0,
      items: [
        { id: 'interstellar', title: '인터스텔라', note: null, score: 9, position: 0 },
        { id: 'odyssey', title: '2001: 스페이스 오디세이', note: null, score: 9, position: 1 },
      ],
    },
    {
      id: 'eight', label: '8점', color: '#E9B949', position: 1,
      items: [{ id: 'hail-mary', title: '프로젝트 헤일메리', note: null, score: 8, position: 0 }],
    },
    {
      id: 'seven-five', label: '7.5점', color: '#A8B66B', position: 2,
      items: [
        { id: 'gravity', title: '그래비티', note: null, score: 7.5, position: 0 },
        { id: 'martian', title: '마션', note: null, score: 7.5, position: 1 },
      ],
    },
    {
      id: 'seven', label: '7점', color: '#5B9F8C', position: 3,
      items: [
        { id: 'minority-report', title: '마이너리티 리포트', note: null, score: 7, position: 0 },
        { id: 'spider-man', title: '스파이더맨: 브랜드 뉴 데이', note: null, score: 7, position: 1 },
      ],
    },
    {
      id: 'six', label: '6점', color: '#668DB8', position: 4,
      items: [{ id: 'avatar', title: '아바타: 불과 재', note: null, score: 6, position: 0 }],
    },
  ],
}

describe('TierTable', () => {
  it('renders the seeded movie items under their requested score rows', () => {
    render(<TierTable board={movieBoard} />)

    const expectedRows = [
      ['9점', ['인터스텔라', '2001: 스페이스 오디세이']],
      ['8점', ['프로젝트 헤일메리']],
      ['7.5점', ['그래비티', '마션']],
      ['7점', ['마이너리티 리포트', '스파이더맨: 브랜드 뉴 데이']],
      ['6점', ['아바타: 불과 재']],
    ] as const

    expect(screen.getByLabelText('SF 영화 티어표 티어표')).toBeInTheDocument()
    for (const [label, titles] of expectedRows) {
      const row = screen.getByRole('heading', { name: label }).closest('section')
      expect(row).not.toBeNull()
      for (const title of titles) {
        expect(within(row as HTMLElement).getByText(title)).toBeInTheDocument()
      }
    }
  })
})
