import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TierBoard } from '../lib'
import { BoardEditor } from './BoardEditor'

const { saveBoardMock } = vi.hoisted(() => ({
  saveBoardMock: vi.fn(),
}))

vi.mock('../lib', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib')>(),
  saveBoard: saveBoardMock,
}))

const board = (): TierBoard => ({
  id: 'board',
  slug: 'sf-movies',
  title: 'SF 영화',
  category: '영화',
  description: null,
  ownerId: 'owner',
  isPublic: true,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  rows: [
    {
      id: 'nine', label: '9점', color: '#E26645', position: 0,
      items: [
        { id: 'interstellar', title: '인터스텔라', note: null, score: 9, position: 0 },
        { id: 'odyssey', title: '오디세이', note: null, score: 9, position: 1 },
      ],
    },
    {
      id: 'eight', label: '8점', color: '#E9B949', position: 1,
      items: [{ id: 'hail-mary', title: '프로젝트 헤일메리', note: null, score: 8, position: 0 }],
    },
  ],
})

describe('BoardEditor', () => {
  beforeEach(() => {
    saveBoardMock.mockReset()
  })

  it('moves rows and items with accessible controls instead of drag gestures', async () => {
    const user = userEvent.setup()
    render(<BoardEditor board={board()} onCancel={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '9점 아래로 이동' }))
    await user.click(screen.getByRole('button', { name: '인터스텔라 뒤로 이동' }))

    const rowSections = document.querySelectorAll('.editor-row')
    expect(within(rowSections[0] as HTMLElement).getByRole('textbox', { name: '행 이름' })).toHaveValue('8점')
    expect(within(rowSections[1] as HTMLElement).getAllByRole('textbox', { name: '항목' }).map((input) => input.getAttribute('value')))
      .toEqual(['오디세이', '인터스텔라'])
  })

  it('relocates an item between rows using the row select control', async () => {
    const user = userEvent.setup()
    render(<BoardEditor board={board()} onCancel={vi.fn()} onSaved={vi.fn()} />)

    const interstellar = screen.getByDisplayValue('인터스텔라').closest('article')
    expect(interstellar).not.toBeNull()
    await user.selectOptions(within(interstellar as HTMLElement).getByRole('combobox', { name: '행 이동' }), 'eight')

    const rowSections = document.querySelectorAll('.editor-row')
    expect(within(rowSections[0] as HTMLElement).queryByDisplayValue('인터스텔라')).not.toBeInTheDocument()
    expect(within(rowSections[1] as HTMLElement).getByDisplayValue('인터스텔라')).toBeInTheDocument()
  })

  it('passes edited fields to the normalizing data boundary', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const savedBoard = { ...board(), title: '수정된 SF 영화' }
    saveBoardMock.mockResolvedValue(savedBoard)
    render(<BoardEditor board={board()} onCancel={vi.fn()} onSaved={onSaved} />)

    const title = screen.getByRole('textbox', { name: '제목' })
    await user.clear(title)
    await user.type(title, '  수정된 SF 영화  ')
    const interstellar = screen.getByDisplayValue('인터스텔라').closest('article')
    expect(interstellar).not.toBeNull()
    const item = within(interstellar as HTMLElement)
    await user.clear(item.getByRole('textbox', { name: '항목' }))
    await user.type(item.getByRole('textbox', { name: '항목' }), '  인터스텔라 IMAX  ')
    await user.clear(item.getByRole('spinbutton', { name: '점수' }))
    await user.type(item.getByRole('spinbutton', { name: '점수' }), '9.5')
    await user.type(item.getByRole('textbox', { name: /메모/ }), '  극장에서 다시 보기  ')
    await user.click(screen.getByRole('button', { name: '변경 내용 저장' }))

    expect(saveBoardMock).toHaveBeenCalledOnce()
    expect(saveBoardMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '  수정된 SF 영화  ',
      rows: expect.arrayContaining([
        expect.objectContaining({
          position: 0,
          items: expect.arrayContaining([
            expect.objectContaining({
              title: '  인터스텔라 IMAX  ',
              note: '  극장에서 다시 보기  ',
              score: 9.5,
              position: 0,
            }),
          ]),
        }),
      ]),
    }))
    expect(onSaved).toHaveBeenCalledWith(savedBoard)
  })

  it('does not add scores outside the shared 0.1 precision rule', async () => {
    const user = userEvent.setup()
    render(<BoardEditor board={board()} onCancel={vi.fn()} onSaved={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('작품, 곡, 대상 이름'), '잘못된 점수')
    await user.type(screen.getByPlaceholderText('점수'), '7.55')

    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled()
    expect(screen.queryByDisplayValue('잘못된 점수')).toBeInTheDocument()
  })

  it('shows the shared validation reason instead of silently disabling save', async () => {
    const user = userEvent.setup()
    render(<BoardEditor board={board()} onCancel={vi.fn()} onSaved={vi.fn()} />)

    const secondRow = document.querySelectorAll('.editor-row')[1] as HTMLElement
    const label = within(secondRow).getByRole('textbox', { name: '행 이름' })
    await user.clear(label)
    await user.type(label, '9점')

    expect(screen.getByRole('alert')).toHaveTextContent('같은 이름의 행을 두 번 만들 수 없습니다.')
    expect(screen.getByRole('button', { name: '변경 내용 저장' })).toBeDisabled()
  })
})
