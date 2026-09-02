import { ensureSession, getSupabaseClient } from './supabase'
import type {
  BoardDraft,
  BoardSummary,
  CreateBoardInput,
  TierBoard,
  TierItem,
  TierRow,
} from './types'
import { normalizeBoardDraft, validateBoardDraft } from './validation'

type ItemRecord = {
  id: string
  title: string
  note: string | null
  score: number | string | null
  position: number
}

type RowRecord = {
  id: string
  label: string
  color: string
  position: number
  tier_items?: ItemRecord[] | null
}

type BoardRecord = {
  id: string
  slug: string
  title: string
  category: string
  description: string | null
  owner_id: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  tier_rows?: RowRecord[] | null
}

const BOARD_SELECT = `
  id, slug, title, category, description, owner_id, is_public, created_at, updated_at,
  tier_rows (id, label, color, position, tier_items (id, title, note, score, position))
`

function mapItem(item: ItemRecord): TierItem {
  return {
    id: item.id,
    title: item.title,
    note: item.note,
    score: item.score === null ? null : Number(item.score),
    position: item.position,
  }
}

function mapRow(row: RowRecord): TierRow {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    position: row.position,
    items: [...(row.tier_items ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(mapItem),
  }
}

function mapBoard(board: BoardRecord): TierBoard {
  return {
    id: board.id,
    slug: board.slug,
    title: board.title,
    category: board.category,
    description: board.description,
    ownerId: board.owner_id,
    isPublic: board.is_public,
    createdAt: board.created_at,
    updatedAt: board.updated_at,
    rows: [...(board.tier_rows ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(mapRow),
  }
}

function rpcPayload(draft: BoardDraft) {
  const normalized = normalizeBoardDraft(draft)
  return {
    title: normalized.title,
    category: normalized.category,
    description: normalized.description,
    is_public: normalized.isPublic,
    rows: normalized.rows.map((row) => ({
      label: row.label,
      color: row.color,
      items: row.items.map((item) => ({
        title: item.title,
        note: item.note ?? null,
        score: item.score ?? null,
      })),
    })),
  }
}

function mapRpcBoard(data: unknown): TierBoard {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('저장된 티어표 데이터를 받지 못했습니다.')
  }
  return mapBoard(data as BoardRecord)
}

function throwRpcError(error: { code?: string; message?: string }): never {
  if (error.code === '40001' || error.message?.includes('another tab')) {
    throw new Error('다른 탭에서 이 티어표가 먼저 수정되었습니다. 새로고침한 뒤 다시 편집해 주세요.')
  }
  if (error.code === '54000' || error.message?.includes('board limit reached')) {
    throw new Error('이 브라우저에서 만들 수 있는 티어표 25개를 모두 사용했습니다.')
  }
  throw error
}

type BoardSummaryRecord = {
  id: string
  slug: string
  title: string
  category: string
  description: string | null
  updated_at: string
  item_count: number | string
  rows: BoardSummary['rows'] | null
}

export async function listPublicBoards(): Promise<BoardSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('tier_board_gallery')
    .select('id, slug, title, category, description, updated_at, item_count, rows')
    .order('updated_at', { ascending: false })
    .limit(24)
  if (error) throw error
  return (data as unknown as BoardSummaryRecord[]).map((board) => ({
    id: board.id,
    slug: board.slug,
    title: board.title,
    category: board.category,
    description: board.description,
    updatedAt: board.updated_at,
    itemCount: Number(board.item_count),
    rows: board.rows ?? [],
  }))
}

export async function getBoardBySlug(slug: string): Promise<TierBoard | null> {
  const normalizedSlug = slug.trim().toLocaleLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) return null

  const { data, error } = await getSupabaseClient()
    .from('tier_boards')
    .select(BOARD_SELECT)
    .eq('slug', normalizedSlug)
    .maybeSingle()
  if (error) throw error
  return data ? mapBoard(data as unknown as BoardRecord) : null
}

export async function createBoard(
  input: CreateBoardInput,
  captchaToken: string,
): Promise<TierBoard> {
  await ensureSession(captchaToken)
  const { data, error } = await getSupabaseClient().rpc('create_tier_board', {
    p_board: rpcPayload(input),
  })
  if (error) throwRpcError(error)
  return mapRpcBoard(data)
}

export async function saveBoard(board: TierBoard): Promise<TierBoard> {
  validateBoardDraft(board)
  const user = await ensureSession()
  if (board.ownerId !== user.id) {
    throw new Error('이 티어표를 수정할 권한이 없습니다.')
  }

  const { data, error } = await getSupabaseClient().rpc('save_tier_board', {
    p_board_id: board.id,
    p_board: rpcPayload(board),
    p_expected_updated_at: board.updatedAt,
  })
  if (error) throwRpcError(error)
  return mapRpcBoard(data)
}

export async function deleteBoard(board: Pick<TierBoard, 'id' | 'ownerId'>) {
  const user = await ensureSession()
  if (board.ownerId !== user.id) {
    throw new Error('이 티어표를 삭제할 권한이 없습니다.')
  }
  const { data, error } = await getSupabaseClient().rpc('delete_tier_board', {
    p_board_id: board.id,
  })
  if (error) throwRpcError(error)
  if (data !== board.id) throw new Error('삭제된 티어표 ID가 일치하지 않습니다.')
}

export async function canEditBoard(
  board: Pick<TierBoard, 'ownerId'>,
): Promise<boolean> {
  if (!board.ownerId) return false
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throw error
  return data.session?.user.id === board.ownerId
}
