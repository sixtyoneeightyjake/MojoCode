'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseConfig } from './config'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient

  const config = getSupabaseConfig()
  
  if (!config.url || !config.anonKey) {
    throw new Error('Missing required Supabase configuration')
  }

  browserClient = createBrowserClient(config.url, config.anonKey)
  return browserClient
}
