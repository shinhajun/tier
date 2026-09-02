export type TierItem = {
  id: string
  title: string
  note: string | null
  score: number | null
  position: number
}

export type TierRow = {
  id: string
  label: string
  color: string
  position: number
  items: TierItem[]
}

export type TierBoard = {
  id: string
  slug: string
  title: string
  category: string
  description: string | null
  ownerId: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
  rows: TierRow[]
}

export type ItemDraft = Omit<TierItem, 'id' | 'position'> & {
  id?: string
  position?: number
}

export type RowDraft = Omit<TierRow, 'id' | 'position' | 'items'> & {
  id?: string
  position?: number
  items: ItemDraft[]
}

export type BoardDraft = Pick<
  TierBoard,
  'title' | 'category' | 'description' | 'isPublic'
> & {
  rows: RowDraft[]
}

export type CreateBoardInput = BoardDraft

export type BoardSummary = Pick<
  TierBoard,
  'id' | 'slug' | 'title' | 'category' | 'description' | 'updatedAt'
> & {
  itemCount: number
  rows: Array<Pick<TierRow, 'id' | 'label' | 'color' | 'position'> & {
    items: string[]
  }>
}
