import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) throw new Error('Supabase public environment is required.')

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const { data, error } = await supabase.auth.signInAnonymously()

if (data.user || error?.code !== 'captcha_failed') {
  throw new Error('Anonymous sign-in without a Turnstile token was not rejected.')
}

console.log(JSON.stringify({ noTokenAnonymousSignInRejected: true }))
