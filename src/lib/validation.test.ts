import { describe, expect, it } from 'vitest'
import type { BoardDraft } from './types'
import { BoardValidationError, normalizeBoardDraft } from './validation'

const validBoard = (): BoardDraft => ({
  title: '  영화 티어표  ',
  category: ' 영화 ',
  description: '  개인 평점  ',
  isPublic: true,
  rows: [
    {
      label: ' 9점 ',
      color: '#f3c969',
      items: [
        { title: ' 인터스텔라 ', note: ' 다시 보기 ', score: 9 },
      ],
    },
  ],
})

describe('normalizeBoardDraft', () => {
  it('normalizes text, colors, and positions', () => {
    expect(normalizeBoardDraft(validBoard())).toMatchObject({
      title: '영화 티어표',
      category: '영화',
      description: '개인 평점',
      rows: [
        {
          label: '9점',
          color: '#F3C969',
          position: 0,
          items: [
            {
              title: '인터스텔라',
              note: '다시 보기',
              score: 9,
              position: 0,
            },
          ],
        },
      ],
    })
  })

  it('rejects duplicate row labels and invalid scores', () => {
    const input = validBoard()
    input.rows.push({
      label: '9점',
      color: '#ffffff',
      items: [{ title: '오류 항목', note: null, score: 11 }],
    })

    expect(() => normalizeBoardDraft(input)).toThrow(BoardValidationError)
    try {
      normalizeBoardDraft(input)
    } catch (error) {
      expect((error as BoardValidationError).issues).toEqual(
        expect.arrayContaining([
          '같은 이름의 행을 두 번 만들 수 없습니다.',
          '점수는 0~10 사이에서 0.1 단위로 입력해 주세요.',
        ]),
      )
    }
  })

  it('rejects scores with more than one decimal place', () => {
    const input = validBoard()
    input.rows[0].items[0].score = 7.55

    expect(() => normalizeBoardDraft(input)).toThrow(BoardValidationError)
  })
})
