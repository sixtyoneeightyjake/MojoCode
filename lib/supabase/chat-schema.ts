import { createSupabasePgClient, getSupabaseDatabaseUrl } from '@/lib/db'

const CHAT_BOOTSTRAP_SQL = `
  create extension if not exists "uuid-ossp";

  create table if not exists conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid,
    title text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table conversations
    add column if not exists updated_at timestamptz not null default now();

  create index if not exists idx_conversations_updated_at on conversations(updated_at desc);

  create table if not exists messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    role text not null check (role in ('user','assistant','system')),
    content text not null,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_messages_conversation_id on messages(conversation_id);
  create index if not exists idx_messages_created_at on messages(created_at);
`

let ensurePromise: Promise<void> | null = null

async function runEnsureChatTables() {
  const connectionString = getSupabaseDatabaseUrl()
  if (!connectionString) {
    throw new Error(
      'Missing database connection string. Set SUPABASE_DB_URL or POSTGRES_URL to enable chat history.'
    )
  }

  const client = createSupabasePgClient({ connectionString })

  try {
    await client.connect()
    await client.query('begin')
    await client.query(CHAT_BOOTSTRAP_SQL)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function ensureChatTables() {
  if (!ensurePromise) {
    ensurePromise = runEnsureChatTables().catch((error) => {
      ensurePromise = null
      throw error
    })
  }
  return ensurePromise
}

// For testing purposes only.
export function __resetEnsureChatTablesForTests() {
  ensurePromise = null
}
