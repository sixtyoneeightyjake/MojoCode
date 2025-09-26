import { NextResponse } from 'next/server'
import { ensureChatTables } from '@/lib/supabase/chat-schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function normaliseTitle(input?: unknown) {
  if (typeof input !== 'string') {
    return ''
  }
  return input.trim()
}

const DEFAULT_TITLE = 'New Chat'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ conversations: [] }, { status: 401 })
    }

    await ensureChatTables()

    const { data, error: queryError } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (queryError) {
      throw queryError
    }

    return NextResponse.json({ conversations: data ?? [] })
  } catch (error) {
    console.error('[chat-history] Failed to list conversations', error)
    return NextResponse.json(
      { error: 'Unable to load chat history.' },
      { status: 500 }
    )
  }
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

    const payload = await request.json().catch(() => ({}))
    const titleInput = normaliseTitle(payload?.title)
    const title = titleInput ? titleInput.slice(0, 120) : DEFAULT_TITLE

    await ensureChatTables()

    const { data, error: insertError } = await supabase
      .from('conversations')
      .insert({ title, user_id: user.id })
      .select('id, title, created_at, updated_at')
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({ conversation: data })
  } catch (error) {
    console.error('[chat-history] Failed to create conversation', error)
    return NextResponse.json(
      { error: 'Unable to create conversation.' },
      { status: 500 }
    )
  }
}
