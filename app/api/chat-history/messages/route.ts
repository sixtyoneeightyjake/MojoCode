import { NextResponse } from 'next/server'
import { ensureChatTables } from '@/lib/supabase/chat-schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = new Set(['user', 'assistant'])

interface MessagePayload {
  conversationId?: unknown
  messageId?: unknown
  role?: unknown
  content?: unknown
  createdAt?: unknown
  title?: unknown
}

function parsePayload(payload: MessagePayload) {
  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : null
  const messageId = typeof payload.messageId === 'string' ? payload.messageId : null
  const role = typeof payload.role === 'string' ? payload.role : null
  const content = typeof payload.content === 'string' ? payload.content : null
  const createdAt =
    typeof payload.createdAt === 'string' && !Number.isNaN(Date.parse(payload.createdAt))
      ? payload.createdAt
      : null
  const title =
    typeof payload.title === 'string' && payload.title.trim().length > 0
      ? payload.title.trim().slice(0, 120)
      : null

  return { conversationId, messageId, role, content, createdAt, title }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const payload = parsePayload(await request.json().catch(() => ({})))

    if (!payload.conversationId || !payload.messageId) {
      return NextResponse.json({ error: 'Missing conversation or message id.' }, { status: 400 })
    }

    if (!payload.role || !ALLOWED_ROLES.has(payload.role)) {
      return NextResponse.json({ error: 'Unsupported message role.' }, { status: 400 })
    }

    if (!payload.content || payload.content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required.' }, { status: 400 })
    }

    await ensureChatTables()

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', payload.conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (conversationError) {
      throw conversationError
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    const timestamp = payload.createdAt ?? new Date().toISOString()

    const { error: upsertError } = await supabase.from('messages').upsert(
      {
        id: payload.messageId,
        conversation_id: payload.conversationId,
        role: payload.role,
        content: payload.content,
        created_at: timestamp,
      },
      { onConflict: 'id' }
    )

    if (upsertError) {
      throw upsertError
    }

    const conversationUpdates: Record<string, string> = { updated_at: timestamp }
    if (payload.title) {
      conversationUpdates.title = payload.title
    }

    const { error: updateError } = await supabase
      .from('conversations')
      .update(conversationUpdates)
      .eq('id', payload.conversationId)
      .eq('user_id', user.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[chat-history] Failed to persist message', error)
    return NextResponse.json(
      { error: 'Unable to save chat message.' },
      { status: 500 }
    )
  }
}
