'use client'

import { createBrowserClient } from '@supabase/ssr'

function getEnvVar(key: string) {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
