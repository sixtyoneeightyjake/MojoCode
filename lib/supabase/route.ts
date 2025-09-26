import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function getEnvVar(key: string) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookies) {
          cookies.forEach((cookie) => {
            cookieStore.set({
              name: cookie.name,
              value: cookie.value,
              ...cookie.options,
            })
          })
        },
      },
    }
  )
}
