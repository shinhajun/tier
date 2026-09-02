import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canEditBoard, createBoard, deleteBoard, saveBoard } from './boards'
import type { BoardDraft, TierBoard } from './types'

const { ensureSessionMock, getSessionMock, rpcMock } = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
  rpcMock: vi.fn(),
}))

vi.mock('./supabase', () => ({
  ensureSession: ensureSessionMock,
  getSupabaseClient: () => ({
    auth: { getSession: getSessionMock },
    rpc: rpcMock,
  }),
}))

describe('board ownership boundary', () => {
  beforeEach(() => {
    ensureSessionMock.mockReset()
    getSessionMock.mockReset()
    rpcMock.mockReset()
  })

  it('propagates session failures instead of silently hiding edit access', async () => {
    const failure = new Error('세션 조회 실패')
    getSessionMock.mockResolvedValue({ data: { session: null }, error: failure })

    await expect(canEditBoard({ ownerId: 'owner' })).rejects.toBe(failure)
  })

  it('deletes through the owner-only RPC after direct writes are revoked', async () => {
    ensureSessionMock.mockResolvedValue({ id: 'owner' })
    rpcMock.mockResolvedValue({ data: 'board-id', error: null })

    await expect(deleteBoard({ id: 'board-id', ownerId: 'owner' })).resolves.toBeUndefined()
    expect(rpcMock).toHaveBeenCalledWith('delete_tier_board', { p_board_id: 'board-id' })
  })

  it('returns the board from the create transaction without a second read', async () => {
    const input: BoardDraft = {
      title: '검증 티어표',
      category: '검증',
      description: null,
      isPublic: true,
      rows: [{ label: 'A', color: '#183153', items: [] }],
    }
    ensureSessionMock.mockResolvedValue({ id: 'owner' })
    rpcMock.mockResolvedValue({
      error: null,
      data: {
        id: 'board-id', slug: 'board-slug', title: input.title, category: input.category,
        description: null, owner_id: 'owner', is_public: true,
        created_at: '2026-09-02T00:00:00.000Z', updated_at: '2026-09-02T00:00:00.000Z',
        tier_rows: [],
      },
    })

    await expect(createBoard(input, 'captcha-token')).resolves.toMatchObject({
      id: 'board-id',
      slug: 'board-slug',
    })
    expect(ensureSessionMock).toHaveBeenCalledWith('captcha-token')
    expect(rpcMock).toHaveBeenCalledOnce()
  })

  it('sends the last update timestamp as the stale-write precondition', async () => {
    const board: TierBoard = {
      id: 'board-id', slug: 'board-slug', title: '검증 티어표', category: '검증',
      description: null, ownerId: 'owner', isPublic: true,
      createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
      rows: [{ id: 'row', label: 'A', color: '#183153', position: 0, items: [] }],
    }
    ensureSessionMock.mockResolvedValue({ id: 'owner' })
    rpcMock.mockResolvedValue({
      error: null,
      data: {
        id: board.id, slug: board.slug, title: board.title, category: board.category,
        description: null, owner_id: 'owner', is_public: true,
        created_at: board.createdAt, updated_at: '2026-09-02T00:01:00.000Z', tier_rows: [],
      },
    })

    await saveBoard(board)
    expect(rpcMock).toHaveBeenCalledWith('save_tier_board', expect.objectContaining({
      p_expected_updated_at: board.updatedAt,
    }))
  })
})
