import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(
      'Supabase가 설정되지 않았습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 확인해 주세요.',
    )
    this.name = 'SupabaseConfigurationError'
  }
}

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && publishableKey)

let client: SupabaseClient | null = null
let sessionRequest: Promise<User> | null = null

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured || !url || !publishableKey) {
    throw new SupabaseConfigurationError()
  }

  client ??= createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

export async function ensureSession(captchaToken?: string): Promise<User> {
  if (sessionRequest) return sessionRequest

  sessionRequest = (async () => {
    const supabase = getSupabaseClient()
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (sessionData.session?.user) return sessionData.session.user

    if (!captchaToken) {
      throw new Error('티어표를 만들기 전에 보안 확인을 완료해 주세요.')
    }

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { captchaToken },
    })
    if (error) throw error
    if (!data.user) throw new Error('익명 세션을 만들지 못했습니다.')
    return data.user
  })()

  try {
    return await sessionRequest
  } finally {
    sessionRequest = null
  }
}
