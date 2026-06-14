import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    '[Wavy] Missing Supabase credentials. ' +
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.'
  )
}

/**
 * Server-side Supabase client using the service role key.
 * This client bypasses Row Level Security — use only on the backend.
 * NEVER expose this client or its key to the browser.
 */
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Verify a Supabase JWT from an Authorization header.
 * Returns the user if the token is valid, or null otherwise.
 */
export async function verifyToken(token: string) {
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
