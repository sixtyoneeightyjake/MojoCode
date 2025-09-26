import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function getEnvVar(key: string) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(_name: string, _value: string, _options: CookieOptions) {
          // The server component cookies API does not allow setting values
        },
        remove(_name: string, _options: CookieOptions) {
          // The server component cookies API does not allow removing values
        },
      },
    }
  )
}
