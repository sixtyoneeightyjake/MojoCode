import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseAdminClient(): SupabaseClient | null {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[supabase-admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}
