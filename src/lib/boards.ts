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

const ADMIN_KEY_STORAGE = 'tier.admin-key'

function getStoredAdminKey() {
  return window.localStorage.getItem(ADMIN_KEY_STORAGE)?.trim() || null
}

function forgetAdminKey() {
  window.localStorage.removeItem(ADMIN_KEY_STORAGE)
}

async function isCurrentOwner(board: Pick<TierBoard, 'ownerId'>) {
  if (!board.ownerId) return false
  const { data, error } = await getSupabaseClient().auth.getSession()
  if (error) throw error
  return data.session?.user.id === board.ownerId
}

async function verifyAdminKey(adminKey: string) {
  const { data, error } = await getSupabaseClient().rpc('verify_tier_admin', {
    p_admin_key: adminKey,
  })
  if (error) throw error
  return data === true
}

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
}

export async function listPublicBoards(): Promise<BoardSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('tier_board_gallery')
    .select('id, slug, title, category, description, updated_at, item_count')
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
  const adminKey = getStoredAdminKey()
  const owner = await isCurrentOwner(board)
  if (!owner && !adminKey) throw new Error('관리자 키로 편집 잠금을 먼저 해제해 주세요.')

  const rpc = owner ? 'save_tier_board' : 'admin_save_tier_board'
  const input = {
    p_board_id: board.id,
    p_board: rpcPayload(board),
    p_expected_updated_at: board.updatedAt,
    ...(!owner && adminKey ? { p_admin_key: adminKey } : {}),
  }
  const { data, error } = await getSupabaseClient().rpc(rpc, input)
  if (!owner && error?.code === '42501') forgetAdminKey()
  if (error) throwRpcError(error)
  return mapRpcBoard(data)
}

export async function deleteBoard(board: Pick<TierBoard, 'id' | 'ownerId'>) {
  const adminKey = getStoredAdminKey()
  const owner = await isCurrentOwner(board)
  if (!owner && !adminKey) throw new Error('관리자 키로 편집 잠금을 먼저 해제해 주세요.')

  const rpc = owner ? 'delete_tier_board' : 'admin_delete_tier_board'
  const { data, error } = await getSupabaseClient().rpc(rpc, {
    p_board_id: board.id,
    ...(!owner && adminKey ? { p_admin_key: adminKey } : {}),
  })
  if (!owner && error?.code === '42501') forgetAdminKey()
  if (error) throwRpcError(error)
  if (data !== board.id) throw new Error('삭제된 티어표 ID가 일치하지 않습니다.')
}

export async function unlockAdminEditing(input: string) {
  const adminKey = input.trim()
  if (!adminKey) throw new Error('관리자 키를 입력해 주세요.')
  if (!await verifyAdminKey(adminKey)) {
    forgetAdminKey()
    throw new Error('관리자 키가 올바르지 않습니다.')
  }
  window.localStorage.setItem(ADMIN_KEY_STORAGE, adminKey)
}

export async function canEditBoard(
  board: Pick<TierBoard, 'ownerId'>,
): Promise<boolean> {
  if (await isCurrentOwner(board)) return true
  const adminKey = getStoredAdminKey()
  if (!adminKey) return false
  if (await verifyAdminKey(adminKey)) return true
  forgetAdminKey()
  return false
}
