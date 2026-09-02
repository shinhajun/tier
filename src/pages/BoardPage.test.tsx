import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TierBoard } from '../lib'
import { BoardPage } from './BoardPage'

const { canEditBoardMock, getBoardBySlugMock, unlockBoardEditingMock } = vi.hoisted(() => ({
  canEditBoardMock: vi.fn(),
  getBoardBySlugMock: vi.fn(),
  unlockBoardEditingMock: vi.fn(),
}))

vi.mock('../lib', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib')>(),
  canEditBoard: canEditBoardMock,
  getBoardBySlug: getBoardBySlugMock,
  unlockBoardEditing: unlockBoardEditingMock,
}))

vi.mock('../components/BoardEditor', () => ({
  BoardEditor: () => <h2>편집 화면</h2>,
}))

const board: TierBoard = {
  id: 'seed',
  slug: 'space-movie-scores',
  title: '우주와 미래를 그린 영화',
  category: '영화',
  description: '개인 평점',
  ownerId: null,
  isPublic: true,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  rows: [{
    id: 'nine', label: '9점', color: '#E26645', position: 0,
    items: [{ id: 'interstellar', title: '인터스텔라', note: null, score: 9, position: 0 }],
  }],
}

describe('BoardPage personal edit unlock', () => {
  beforeEach(() => {
    canEditBoardMock.mockReset().mockResolvedValue(false)
    getBoardBySlugMock.mockReset().mockResolvedValue(board)
    unlockBoardEditingMock.mockReset().mockResolvedValue(undefined)
  })

  it('offers edit on a locked seed and opens the full editor after a valid key', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/t/space-movie-scores']}>
        <Routes><Route path="/t/:slug" element={<BoardPage />} /></Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '수정' }))
    await user.type(screen.getByLabelText('수정 키'), 'personal-edit-key')
    await user.click(screen.getByRole('button', { name: '잠금 해제' }))

    expect(unlockBoardEditingMock).toHaveBeenCalledWith('seed', 'personal-edit-key')
    expect(await screen.findByRole('heading', { name: '편집 화면' })).toBeInTheDocument()
  })

  it('keeps the key prompt open and shows a useful invalid-key error', async () => {
    const user = userEvent.setup()
    unlockBoardEditingMock.mockRejectedValue(new Error('수정 키가 올바르지 않습니다.'))
    render(
      <MemoryRouter initialEntries={['/t/space-movie-scores']}>
        <Routes><Route path="/t/:slug" element={<BoardPage />} /></Routes>
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: '수정' }))
    await user.type(screen.getByLabelText('수정 키'), 'wrong-key')
    await user.click(screen.getByRole('button', { name: '잠금 해제' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('수정 키가 올바르지 않습니다.')
    expect(screen.getByLabelText('수정 키')).toBeInTheDocument()
  })
})
