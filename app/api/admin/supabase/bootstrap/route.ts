import { NextResponse } from 'next/server'
import { createSupabasePgClient, getSupabaseDatabaseUrl } from '@/lib/db'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { ensureChatTables } from '@/lib/supabase/chat-schema'

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

function required(name: string, value: string | undefined | null) {
  if (!value || value.trim().length === 0) {
    throw new HttpError(500, `Missing env: ${name}`)
  }
  return value
}

async function requireAdminAccess() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const isProduction = process.env.NODE_ENV === 'production'

  if (!adminEmail) {
    if (isProduction) {
      throw new HttpError(
        403,
        'ADMIN_EMAIL is not configured; refusing to run bootstrap in production.'
      )
    }
    return { reason: 'development-mode' as const }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new HttpError(401, 'Authentication required.')
  }

  const email = user.email?.toLowerCase()
  if (!email || email !== adminEmail) {
    throw new HttpError(403, 'Insufficient privileges to run the Supabase bootstrap.')
  }

  return { reason: 'admin-email', userId: user.id }
}

function getServiceRoleKey() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new HttpError(
      500,
      'Missing env: SUPABASE_SERVICE_ROLE (or SUPABASE_SERVICE_ROLE_KEY).'
    )
  }
  return key
}

const SAMPLE_CONVERSATION_ID = '00000000-0000-4000-8000-000000000001'
const SAMPLE_USER_MESSAGE_ID = '00000000-0000-4000-8000-000000000002'
const SAMPLE_ASSISTANT_MESSAGE_ID = '00000000-0000-4000-8000-000000000003'

interface BootstrapRequestBody {
  seed?: boolean
}

export async function POST(request: Request) {
  try {
    const access = await requireAdminAccess()

    const { seed = false }: BootstrapRequestBody = await request
      .json()
      .catch(() => ({ seed: false }))

    required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
    getServiceRoleKey()

    const connectionString = getSupabaseDatabaseUrl()
    if (!connectionString) {
      throw new HttpError(
        500,
        'Missing database connection string. Set SUPABASE_DB_URL or POSTGRES_URL.'
      )
    }

    const steps: string[] = []
    const warnings: string[] = []

    steps.push('Validated Supabase configuration')

    if (access.reason === 'development-mode') {
      warnings.push('Running without ADMIN_EMAIL in development mode.')
    }

    await ensureChatTables()
    steps.push('Ensured conversations/messages schema')

    if (seed) {
      const client = createSupabasePgClient({ connectionString })
      await client.connect()
      steps.push('Connected for seeding')

      try {
        await client.query('begin')

        const {
          rowCount: conversationInsertCount,
        } = await client.query(
          `
            insert into conversations (id, title)
            values ($1, $2)
            on conflict (id) do nothing
          `,
          [SAMPLE_CONVERSATION_ID, 'Sample Conversation']
        )

        if (!conversationInsertCount) {
          warnings.push('Sample conversation already exists; skipped insert.')
        } else {
          steps.push('Inserted sample conversation')
        }

        const { rowCount: messageInsertCount } = await client.query(
          `
            insert into messages (id, conversation_id, role, content)
            values
              ($1, $3, 'user', $4),
              ($2, $3, 'assistant', $5)
            on conflict (id) do nothing
          `,
          [
            SAMPLE_USER_MESSAGE_ID,
            SAMPLE_ASSISTANT_MESSAGE_ID,
            SAMPLE_CONVERSATION_ID,
            'This is a demo message. Future chats will be stored here once Supabase is connected.',
            'Great! Supabase is now storing your chat history.',
          ]
        )

        if (messageInsertCount && messageInsertCount > 0) {
          steps.push('Seeded demo conversation messages')
        } else {
          warnings.push('Demo messages already exist; skipped seeding messages.')
        }

        await client.query('commit')
        steps.push('Seeding transaction committed')
      } catch (error) {
        await client.query('rollback').catch(() => undefined)
        throw error
      } finally {
        await client.end().catch(() => undefined)
      }
    }

    return NextResponse.json({ ok: true, steps, warnings })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      )
    }

    console.error('[supabase-bootstrap] Unexpected error', error)
    return NextResponse.json(
      { ok: false, error: 'Unexpected error while bootstrapping Supabase.' },
      { status: 500 }
    )
  }
}
