import { NextRequest, NextResponse } from 'next/server'
import { ensureChatTables } from '@/lib/supabase/chat-schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface RouteParams {
  conversationId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const conversationId = params.conversationId
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation id missing.' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    await ensureChatTables()

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (conversationError) {
      throw conversationError
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    }

    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (messagesError) {
      throw messagesError
    }

    return NextResponse.json({ messages: messages ?? [] })
  } catch (error) {
    console.error('[chat-history] Failed to load conversation messages', error)
    return NextResponse.json(
      { error: 'Unable to load conversation.' },
      { status: 500 }
    )
  }
}
