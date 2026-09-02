import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) throw new Error('Supabase public environment is required.')

function client() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

async function anonymous(supabase) {
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.user) throw new Error('Anonymous user was not created.')
  return data.user
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const boardPayload = (title = 'Tier integration smoke') => ({
  title,
  category: '검증',
  description: '자동 삭제되는 데이터 경계 검증',
  is_public: true,
  rows: [
    {
      label: '좋음',
      color: '#183153',
      items: [{ title: '검증 항목', note: null, score: 8.5 }],
    },
    { label: '보통', color: '#F8DF8B', items: [] },
  ],
})

const owner = client()
const outsider = client()
let boardId = null

try {
  await anonymous(owner)
  await anonymous(outsider)

  const { count: beforeCount, error: beforeError } = await owner
    .from('tier_boards')
    .select('*', { count: 'exact', head: true })
  if (beforeError) throw beforeError

  const malformed = await owner.rpc('create_tier_board', {
    p_board: { title: 'malformed', category: '검증', is_public: true },
  })
  assert(Boolean(malformed.error), 'Missing rows payload was accepted.')

  const malformedItems = await owner.rpc('create_tier_board', {
    p_board: {
      title: 'malformed items',
      category: '검증',
      is_public: true,
      rows: [{ label: '오류', color: '#183153' }],
    },
  })
  assert(Boolean(malformedItems.error), 'Missing items payload was accepted.')

  const invalidPrecision = await owner.rpc('create_tier_board', {
    p_board: {
      ...boardPayload('invalid precision'),
      rows: [{ label: '오류', color: '#183153', items: [{ title: '오류', score: 7.55 }] }],
    },
  })
  assert(Boolean(invalidPrecision.error), 'Invalid score precision was accepted.')

  const { count: afterMalformedCount, error: afterMalformedError } = await owner
    .from('tier_boards')
    .select('*', { count: 'exact', head: true })
  if (afterMalformedError) throw afterMalformedError
  assert(afterMalformedCount === beforeCount, 'Malformed RPC changed board count.')

  const created = await owner.rpc('create_tier_board', { p_board: boardPayload() })
  if (created.error) throw created.error
  assert(created.data?.slug && created.data?.updated_at, 'Create RPC did not return a complete board.')
  boardId = created.data.id

  const publicRead = await outsider
    .from('tier_boards')
    .select('id, slug')
    .eq('id', boardId)
    .single()
  if (publicRead.error) throw publicRead.error

  const directWrite = await owner
    .from('tier_boards')
    .update({ title: 'direct write must fail' })
    .eq('id', boardId)
  assert(Boolean(directWrite.error), 'Authenticated direct write was not revoked.')

  const seedWrite = await owner
    .from('tier_boards')
    .update({ title: 'seed must stay read-only' })
    .eq('slug', 'space-movie-scores')
  assert(Boolean(seedWrite.error), 'Seed accepted a direct write.')

  const outsiderSave = await outsider.rpc('save_tier_board', {
    p_board_id: boardId,
    p_board: boardPayload('outsider write'),
    p_expected_updated_at: created.data.updated_at,
  })
  assert(Boolean(outsiderSave.error), 'Non-owner save was accepted.')

  const ownerSave = await owner.rpc('save_tier_board', {
    p_board_id: boardId,
    p_board: boardPayload('owner write passed'),
    p_expected_updated_at: created.data.updated_at,
  })
  if (ownerSave.error) throw ownerSave.error
  assert(ownerSave.data?.title === 'owner write passed', 'Owner save did not return the saved board.')

  const staleSave = await owner.rpc('save_tier_board', {
    p_board_id: boardId,
    p_board: boardPayload('stale write'),
    p_expected_updated_at: created.data.updated_at,
  })
  assert(Boolean(staleSave.error), 'Stale save was not rejected as a conflict.')

  const deleted = await owner.rpc('delete_tier_board', { p_board_id: boardId })
  if (deleted.error) throw deleted.error
  assert(deleted.data === boardId, 'Delete RPC returned an unexpected ID.')
  boardId = null

  console.log(JSON.stringify({
    anonymousAuth: true,
    malformedRollback: true,
    publicRead: true,
    directWritesRevoked: true,
    ownerWrite: true,
    nonOwnerDenied: true,
    staleWriteDenied: true,
    cleanup: true,
  }))
} finally {
  if (boardId) await owner.rpc('delete_tier_board', { p_board_id: boardId })
}
