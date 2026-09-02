import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canEditBoard, createBoard, deleteBoard, saveBoard, unlockBoardEditing } from './boards'
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
    localStorage.clear()
    ensureSessionMock.mockReset()
    getSessionMock.mockReset()
    rpcMock.mockReset()
  })

  it('propagates session failures instead of silently hiding edit access', async () => {
    const failure = new Error('세션 조회 실패')
    getSessionMock.mockResolvedValue({ data: { session: null }, error: failure })

    await expect(canEditBoard({ id: 'board-id', ownerId: 'owner' })).rejects.toBe(failure)
  })

  it('deletes through the owner-only RPC after direct writes are revoked', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null })
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

    await expect(createBoard(input, 'captcha-token', 'personal-edit-key')).resolves.toMatchObject({
      id: 'board-id',
      slug: 'board-slug',
    })
    expect(ensureSessionMock).toHaveBeenCalledWith('captcha-token')
    expect(rpcMock).toHaveBeenCalledWith('create_tier_board', {
      p_board: expect.any(Object),
      p_edit_key: 'personal-edit-key',
    })
    expect(JSON.parse(localStorage.getItem('tier.board-keys') ?? '{}')).toEqual({
      'board-id': 'personal-edit-key',
    })
  })

  it('sends the last update timestamp as the stale-write precondition', async () => {
    const board: TierBoard = {
      id: 'board-id', slug: 'board-slug', title: '검증 티어표', category: '검증',
      description: null, ownerId: 'owner', isPublic: true,
      createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
      rows: [{ id: 'row', label: 'A', color: '#183153', position: 0, items: [] }],
    }
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null })
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

  it('stores a verified board key and uses the key save RPC for that board', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })

    await expect(unlockBoardEditing('seed', '  personal-edit-key  ')).resolves.toBeUndefined()
    expect(rpcMock).toHaveBeenCalledWith('verify_tier_board_key', {
      p_board_id: 'seed',
      p_edit_key: 'personal-edit-key',
    })

    const seed: TierBoard = {
      id: 'seed', slug: 'space-movie-scores', title: '영화', category: '영화',
      description: null, ownerId: null, isPublic: true,
      createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
      rows: [{ id: 'row', label: '9점', color: '#E26645', position: 0, items: [] }],
    }
    rpcMock.mockResolvedValueOnce({
      error: null,
      data: {
        id: seed.id, slug: seed.slug, title: seed.title, category: seed.category,
        description: null, owner_id: null, is_public: true,
        created_at: seed.createdAt, updated_at: '2026-09-02T00:01:00.000Z', tier_rows: [],
      },
    })

    await saveBoard(seed)
    expect(rpcMock).toHaveBeenLastCalledWith('key_save_tier_board', expect.objectContaining({
      p_board_id: seed.id,
      p_edit_key: 'personal-edit-key',
      p_expected_updated_at: seed.updatedAt,
    }))
    expect(ensureSessionMock).not.toHaveBeenCalled()
  })

  it('does not retain an invalid board key', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null })

    await expect(unlockBoardEditing('board-a', 'wrong-key')).rejects.toThrow('수정 키가 올바르지 않습니다.')
    await expect(canEditBoard({ id: 'board-a', ownerId: null })).resolves.toBe(false)
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  it('does not use one board key to unlock another board', async () => {
    rpcMock.mockResolvedValueOnce({ data: true, error: null })
    await unlockBoardEditing('board-a', 'board-a-key')

    await expect(canEditBoard({ id: 'board-b', ownerId: null })).resolves.toBe(false)
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })
})
