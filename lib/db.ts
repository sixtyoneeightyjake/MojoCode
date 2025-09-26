import { Client, type ClientConfig } from 'pg'

const DATABASE_URL_ENV_PRIORITY = [
  'SUPABASE_DB_URL',
  'SUPABASE_POSTGRES_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE_URL',
]

function inferDefaultSsl(connectionString: string) {
  const lowered = connectionString.toLowerCase()
  const isLocal =
    lowered.includes('localhost') ||
    lowered.includes('127.0.0.1') ||
    lowered.includes('::1')

  if (isLocal) {
    return false
  }

  return { rejectUnauthorized: false }
}

export function getSupabaseDatabaseUrl() {
  for (const key of DATABASE_URL_ENV_PRIORITY) {
    const value = process.env[key]
    if (value && value.trim().length > 0) {
      return value
    }
  }
  return null
}

export function createSupabasePgClient(config: ClientConfig = {}) {
  const { ssl: providedSsl, connectionString: providedConnectionString, ...rest } = config

  const connectionString = providedConnectionString ?? getSupabaseDatabaseUrl()

  if (!connectionString) {
    throw new Error(
      'Missing database connection string. Set SUPABASE_DB_URL or POSTGRES_URL to continue.'
    )
  }

  const ssl = providedSsl ?? inferDefaultSsl(connectionString)

  return new Client({
    connectionString,
    ssl,
    ...rest,
  })
}
