'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquareIcon, Loader2Icon, ClockIcon } from 'lucide-react'
import { useChatHistoryStore } from '@/lib/chat-history-store'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const CONVERSATION_LIST_KEY = '/api/chat-history/conversations'
const DEFAULT_CONVERSATION_TITLE = 'New Chat'

interface ConversationRow {
  id: string
  title: string | null
  created_at: string
  updated_at: string | null
}

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    const error = new Error(`Failed to load chat history (${response.status})`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
  return (await response.json()) as { conversations: ConversationRow[] }
}

export function ChatHistoryDialog() {
  const [open, setOpen] = useState(false)
  const {
    activeConversationId,
    setActiveConversation,
    resetConversation,
  } = useChatHistoryStore((state) => ({
    activeConversationId: state.activeConversationId,
    setActiveConversation: state.setActiveConversation,
    resetConversation: state.resetConversation,
  }))

  const { data, error, isLoading, mutate } = useSWR(
    open ? CONVERSATION_LIST_KEY : null,
    fetcher
  )

  useEffect(() => {
    if (error) {
      const status = (error as Error & { status?: number }).status
      if (status === 401) {
        toast.error('Sign in to access chat history.')
      } else {
        toast.error('Unable to load chat history.')
      }
    }
  }, [error])

  const conversations = data?.conversations ?? []

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  )

  const handleSelectConversation = (conversation: ConversationRow) => {
    setActiveConversation(conversation.id, conversation.title ?? null)
    setOpen(false)
  }

  const handleNewChat = () => {
    resetConversation()
    setOpen(false)
    void mutate()
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(true)}
      >
        <MessageSquareIcon className="h-4 w-4" />
        <span className="sr-only">Open chat history</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MessageSquareIcon className="h-4 w-4" /> Chat History
            </DialogTitle>
            <DialogDescription>
              Continue a previous conversation or start a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              type="button"
              variant="default"
              className="w-full justify-start"
              onClick={handleNewChat}
            >
              Start New Chat
            </Button>

            <div className="border rounded-md">
              <ScrollArea className="max-h-80">
                <div className="divide-y">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                      Loading history…
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No conversations yet.
                    </div>
                  ) : (
                    conversations.map((conversation) => {
                      const timestamp = conversation.updated_at ?? conversation.created_at
                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => handleSelectConversation(conversation)}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-secondary/40 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                            activeConversationId === conversation.id
                              ? 'bg-secondary/60'
                              : undefined
                          )}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-medium text-sm line-clamp-1">
                              {conversation.title?.trim() || DEFAULT_CONVERSATION_TITLE}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                              <ClockIcon className="h-3 w-3" />
                              {formatter.format(new Date(timestamp))}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
