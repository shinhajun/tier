import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TierBoard } from '../lib'
import { NewBoardPage } from './NewBoardPage'

const { createBoardMock } = vi.hoisted(() => ({
  createBoardMock: vi.fn(),
}))

vi.mock('../lib', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib')>(),
  createBoard: createBoardMock,
}))

vi.mock('../components/TurnstileGate', () => ({
  TurnstileGate: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('test-captcha-token')}>보안 확인 완료</button>
  ),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/new']}>
      <Routes>
        <Route path="/new" element={<NewBoardPage />} />
        <Route path="/t/:slug" element={<h1>생성된 티어표</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NewBoardPage', () => {
  beforeEach(() => {
    createBoardMock.mockReset()
  })

  it('replaces score rows when the basic tier template is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /기본형/ }))

    const rowEditor = screen.getByLabelText('티어 행 편집')
    expect(within(rowEditor).getAllByRole('textbox').map((input) => input.getAttribute('value')))
      .toEqual(['SS', 'S', 'A', 'B', 'C', 'D'])
    expect(screen.getByRole('button', { name: /기본형/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('allows rows to be renamed, reordered, added, and removed without dragging', async () => {
    const user = userEvent.setup()
    renderPage()
    const rowEditor = screen.getByLabelText('티어 행 편집')
    const rowNames = within(rowEditor).getAllByRole('textbox')

    await user.clear(rowNames[0])
    await user.type(rowNames[0], '최애')
    await user.click(screen.getByRole('button', { name: '최애 아래로 이동' }))
    await user.click(screen.getByRole('button', { name: /행 추가/ }))
    await user.click(screen.getByRole('button', { name: '새 행 7 삭제' }))

    expect(within(rowEditor).getAllByRole('textbox').map((input) => input.getAttribute('value')))
      .toEqual(['9점', '최애', '8점', '7.5점', '7점', '6점'])
    expect(screen.getByRole('button', { name: /점수형/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('passes the custom board to the data boundary and navigates to its slug', async () => {
    const user = userEvent.setup()
    const createdBoard = {
      slug: 'my-sf-list',
    } as TierBoard
    createBoardMock.mockResolvedValue(createdBoard)
    renderPage()

    await user.type(screen.getByRole('textbox', { name: '제목' }), '  나의 SF 영화  ')
    await user.clear(screen.getByRole('textbox', { name: '카테고리' }))
    await user.type(screen.getByRole('textbox', { name: '카테고리' }), '  영화  ')
    await user.type(screen.getByRole('textbox', { name: /한 줄 설명/ }), '  다시 보고 싶은 작품  ')
    await user.type(screen.getByLabelText('수정 키'), 'personal-edit-key')
    await user.type(screen.getByLabelText('수정 키 확인'), 'personal-edit-key')
    await user.click(screen.getByRole('button', { name: '보안 확인 완료' }))
    await user.click(screen.getByRole('button', { name: '티어표 만들기' }))

    expect(createBoardMock).toHaveBeenCalledOnce()
    expect(createBoardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '  나의 SF 영화  ',
        category: '  영화  ',
        description: '  다시 보고 싶은 작품  ',
        rows: expect.arrayContaining([
          expect.objectContaining({ label: '10점', position: 0 }),
          expect.objectContaining({ label: '6점', position: 5 }),
        ]),
      }),
      'test-captcha-token',
      'personal-edit-key',
    )
    expect(await screen.findByRole('heading', { name: '생성된 티어표' })).toBeInTheDocument()
  })

  it('does not create a board when the edit key confirmation differs', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByRole('textbox', { name: '제목' }), '나의 영화')
    await user.type(screen.getByLabelText('수정 키'), 'personal-edit-key')
    await user.type(screen.getByLabelText('수정 키 확인'), 'different-edit-key')
    await user.click(screen.getByRole('button', { name: '보안 확인 완료' }))

    expect(screen.getByRole('button', { name: '티어표 만들기' })).toBeDisabled()
    expect(screen.getByText('수정 키가 일치하지 않습니다.')).toBeInTheDocument()
    expect(createBoardMock).not.toHaveBeenCalled()
  })
})
