import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'

const { listPublicBoardsMock } = vi.hoisted(() => ({
  listPublicBoardsMock: vi.fn(),
}))

vi.mock('../lib', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib')>(),
  listPublicBoards: listPublicBoardsMock,
}))

describe('HomePage personal mode', () => {
  beforeEach(() => {
    listPublicBoardsMock.mockResolvedValue([
      {
        id: 'movies',
        slug: 'space-movie-scores',
        title: '우주와 미래를 그린 영화',
        category: '영화',
        description: '개인 평점',
        updatedAt: '2026-09-02T00:00:00.000Z',
        itemCount: 9,
        rows: [{ id: 'nine', label: '9점', color: '#E26645', position: 0, items: ['인터스텔라'] }],
      },
    ])
  })

  it('starts with the compact board list instead of showcase copy', async () => {
    render(<MemoryRouter><HomePage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '티어표' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '새 티어표' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /우주와 미래를 그린 영화/ })).toBeInTheDocument()
    expect(screen.queryByText('MAKE YOUR ORDER')).not.toBeInTheDocument()
    expect(screen.queryByText(/좋아하는 것들을/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('티어표 예시')).not.toBeInTheDocument()
  })
})
