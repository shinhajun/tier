import type { BoardDraft, CreateBoardInput, TierBoard } from './types'

export const BOARD_LIMITS = {
  title: 80,
  category: 40,
  description: 500,
  rowLabel: 30,
  itemTitle: 100,
  itemNote: 300,
  rows: 20,
  items: 200,
} as const

export class BoardValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues[0] ?? '티어표 입력을 확인해 주세요.')
    this.name = 'BoardValidationError'
    this.issues = issues
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const textLength = (value: unknown) =>
  typeof value === 'string' ? Array.from(value.trim()).length : -1

export function isValidTierScore(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 10
    && Math.abs(value * 10 - Math.round(value * 10)) < Number.EPSILON * 100
}

export function validateBoardDraft(
  value: BoardDraft | CreateBoardInput | TierBoard,
): void {
  const issues: string[] = []

  if (!isPlainObject(value)) {
    throw new BoardValidationError(['티어표 데이터 형식이 올바르지 않습니다.'])
  }

  const titleLength = textLength(value.title)
  if (titleLength < 1 || titleLength > BOARD_LIMITS.title) {
    issues.push(`제목은 1~${BOARD_LIMITS.title}자로 입력해 주세요.`)
  }

  const categoryLength = textLength(value.category)
  if (categoryLength < 1 || categoryLength > BOARD_LIMITS.category) {
    issues.push(`분류는 1~${BOARD_LIMITS.category}자로 입력해 주세요.`)
  }

  if (
    value.description !== null &&
    (typeof value.description !== 'string' ||
      Array.from(value.description.trim()).length > BOARD_LIMITS.description)
  ) {
    issues.push(`설명은 ${BOARD_LIMITS.description}자 이하로 입력해 주세요.`)
  }

  if (typeof value.isPublic !== 'boolean') {
    issues.push('공개 여부가 올바르지 않습니다.')
  }

  if (!Array.isArray(value.rows) || value.rows.length < 1) {
    issues.push('티어 행을 하나 이상 만들어 주세요.')
  } else if (value.rows.length > BOARD_LIMITS.rows) {
    issues.push(`티어 행은 최대 ${BOARD_LIMITS.rows}개까지 만들 수 있습니다.`)
  }

  let itemCount = 0
  const rowLabels = new Set<string>()

  for (const [rowIndex, row] of (value.rows ?? []).entries()) {
    if (!isPlainObject(row)) {
      issues.push(`${rowIndex + 1}번째 행 형식이 올바르지 않습니다.`)
      continue
    }

    const labelLength = textLength(row.label)
    if (labelLength < 1 || labelLength > BOARD_LIMITS.rowLabel) {
      issues.push(
        `${rowIndex + 1}번째 행 이름은 1~${BOARD_LIMITS.rowLabel}자로 입력해 주세요.`,
      )
    }

    const normalizedLabel =
      typeof row.label === 'string' ? row.label.trim().toLocaleLowerCase() : ''
    if (normalizedLabel && rowLabels.has(normalizedLabel)) {
      issues.push('같은 이름의 행을 두 번 만들 수 없습니다.')
    }
    rowLabels.add(normalizedLabel)

    if (typeof row.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(row.color)) {
      issues.push(`${rowIndex + 1}번째 행 색상은 6자리 HEX 값이어야 합니다.`)
    }

    if (!Array.isArray(row.items)) {
      issues.push(`${rowIndex + 1}번째 행의 항목 형식이 올바르지 않습니다.`)
      continue
    }

    itemCount += row.items.length
    for (const [itemIndex, item] of row.items.entries()) {
      if (!isPlainObject(item)) {
        issues.push(
          `${rowIndex + 1}번째 행 ${itemIndex + 1}번째 항목 형식이 올바르지 않습니다.`,
        )
        continue
      }
      const itemTitleLength = textLength(item.title)
      if (itemTitleLength < 1 || itemTitleLength > BOARD_LIMITS.itemTitle) {
        issues.push(`항목 이름은 1~${BOARD_LIMITS.itemTitle}자로 입력해 주세요.`)
      }
      if (
        item.note !== null &&
        item.note !== undefined &&
        (typeof item.note !== 'string' ||
          Array.from(item.note.trim()).length > BOARD_LIMITS.itemNote)
      ) {
        issues.push(`항목 메모는 ${BOARD_LIMITS.itemNote}자 이하로 입력해 주세요.`)
      }
      if (
        item.score !== null &&
        item.score !== undefined &&
        !isValidTierScore(item.score)
      ) {
        issues.push('점수는 0~10 사이에서 0.1 단위로 입력해 주세요.')
      }
    }
  }

  if (itemCount > BOARD_LIMITS.items) {
    issues.push(`항목은 전체 ${BOARD_LIMITS.items}개까지 추가할 수 있습니다.`)
  }

  if (issues.length > 0) throw new BoardValidationError([...new Set(issues)])
}

export function normalizeBoardDraft<T extends BoardDraft>(value: T): T {
  validateBoardDraft(value)
  return {
    ...value,
    title: value.title.trim(),
    category: value.category.trim(),
    description: value.description?.trim() || null,
    rows: value.rows.map((row, rowIndex) => ({
      ...row,
      label: row.label.trim(),
      color: row.color.toUpperCase(),
      position: rowIndex,
      items: row.items.map((item, itemIndex) => ({
        ...item,
        title: item.title.trim(),
        note: item.note?.trim() || null,
        score: item.score ?? null,
        position: itemIndex,
      })),
    })),
  }
}
