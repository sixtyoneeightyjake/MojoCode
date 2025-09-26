'use client'

import type { ChatUIMessage } from '@/components/chat/types'
import { TEST_PROMPTS } from '@/ai/constants'
import { MessageCircleIcon, SendIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Input } from '@/components/ui/input'
import { Message } from '@/components/chat/message'
import { ModelSelector } from '@/components/settings/model-selector'
import { Panel, PanelHeader } from '@/components/panels/panels'
import { Settings } from '@/components/settings/settings'
import { useChat } from '@ai-sdk/react'
import { useLocalStorageValue } from '@/lib/use-local-storage-value'
import { useCallback, useEffect, useRef } from 'react'
import { useSharedChatContext } from '@/lib/chat-context'
import { useSettings } from '@/components/settings/use-settings'
import { useSandboxStore } from './state'
import { useChatHistoryStore } from '@/lib/chat-history-store'
import { toast } from 'sonner'
import { mutate } from 'swr'

const CONVERSATION_LIST_KEY = '/api/chat-history/conversations'
const DEFAULT_CONVERSATION_TITLE = 'New Chat'

function getMessageText(message: ChatUIMessage) {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
}

function deriveConversationTitle(message: ChatUIMessage) {
  const text = getMessageText(message).trim()
  if (!text) {
    return DEFAULT_CONVERSATION_TITLE
  }
  return text.slice(0, 80)
}

function mapDbMessageToChatMessage(message: {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}) {
  return {
    id: message.id,
    role: message.role,
    parts: [
      {
        type: 'text' as const,
        text: message.content,
      },
    ],
    metadata:
      message.role === 'assistant'
        ? {
            model: 'history',
          }
        : undefined,
  } satisfies ChatUIMessage
}

interface Props {
  className: string
  modelId?: string
}

export function Chat({ className }: Props) {
  const [input, setInput] = useLocalStorageValue('prompt-input')
  const { chat } = useSharedChatContext()
  const { modelId, reasoningEffort } = useSettings()
  const { messages, sendMessage, status, setMessages } = useChat<ChatUIMessage>({ chat })
  const setChatStatus = useSandboxStore((state) => state.setChatStatus)
  const {
    activeConversationId,
    setActiveConversation,
    resetConversation,
  } = useChatHistoryStore((state) => ({
    activeConversationId: state.activeConversationId,
    setActiveConversation: state.setActiveConversation,
    resetConversation: state.resetConversation,
  }))

  const persistedMessageIdsRef = useRef<Set<string>>(new Set())
  const creatingConversationRef = useRef(false)
  const creationFailedRef = useRef(false)
  const lastCreationAttemptMessageIdRef = useRef<string | null>(null)
  const skipNextLoadConversationIdRef = useRef<string | null>(null)
  const persistenceDisabledRef = useRef(false)

  const validateAndSubmitMessage = useCallback(
    (text: string) => {
      if (text.trim()) {
        sendMessage({ text }, { body: { modelId, reasoningEffort } })
        setInput('')
      }
    },
    [sendMessage, modelId, setInput, reasoningEffort]
  )

  useEffect(() => {
    setChatStatus(status)
  }, [status, setChatStatus])

  useEffect(() => {
    let aborted = false

    if (!activeConversationId) {
      creatingConversationRef.current = false
      creationFailedRef.current = false
      lastCreationAttemptMessageIdRef.current = null
      persistenceDisabledRef.current = false
      persistedMessageIdsRef.current = new Set()
      setMessages([])
      setInput('')
      return
    }

    if (skipNextLoadConversationIdRef.current === activeConversationId) {
      skipNextLoadConversationIdRef.current = null
      return
    }

    const loadConversation = async () => {
      try {
        const response = await fetch(
          `/api/chat-history/conversations/${activeConversationId}/messages`,
          {
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          if (response.status === 404) {
            if (!aborted) {
              toast.info('Selected conversation is no longer available.')
              resetConversation()
            }
            return
          }
          throw new Error(`Failed to load messages (${response.status})`)
        }

        const data = (await response.json()) as {
          messages?: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string }>
        }

        if (aborted) {
          return
        }

        const loadedMessages = (data.messages ?? []).map(mapDbMessageToChatMessage)
        persistedMessageIdsRef.current = new Set(loadedMessages.map((message) => message.id))
        setMessages(loadedMessages)
        setInput('')
      } catch (error) {
        if (aborted) {
          return
        }
        console.error('[chat] Failed to load conversation messages', error)
        toast.error('Unable to load chat history.')
      }
    }

    void loadConversation()

    return () => {
      aborted = true
    }
  }, [activeConversationId, resetConversation, setMessages, setInput])

  useEffect(() => {
    if (persistenceDisabledRef.current) {
      return
    }

    if (activeConversationId || creatingConversationRef.current) {
      return
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user')

    if (!latestUserMessage) {
      return
    }

    if (
      creationFailedRef.current &&
      lastCreationAttemptMessageIdRef.current === latestUserMessage.id
    ) {
      return
    }

    const title = deriveConversationTitle(latestUserMessage)
    const body = JSON.stringify({ title })

    creatingConversationRef.current = true
    lastCreationAttemptMessageIdRef.current = latestUserMessage.id

    ;(async () => {
      try {
        const response = await fetch('/api/chat-history/conversations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        })

        if (!response.ok) {
          throw new Error(`Failed to create conversation (${response.status})`)
        }

        const data = (await response.json()) as {
          conversation: { id: string; title: string }
        }

        skipNextLoadConversationIdRef.current = data.conversation.id
        persistedMessageIdsRef.current = new Set()
        setActiveConversation(data.conversation.id, data.conversation.title)
        creationFailedRef.current = false
        void mutate(CONVERSATION_LIST_KEY)
      } catch (error) {
        console.error('[chat] Failed to create conversation for history', error)
        creationFailedRef.current = true
        toast.error('Unable to prepare Supabase chat history. Messages will stay local.')
      } finally {
        creatingConversationRef.current = false
      }
    })()
  }, [messages, activeConversationId, setActiveConversation])

  useEffect(() => {
    if (persistenceDisabledRef.current) {
      return
    }

    if (!activeConversationId) {
      return
    }

    const conversationId = activeConversationId

    const messagesToPersist = messages.filter((message) => {
      if (persistedMessageIdsRef.current.has(message.id)) {
        return false
      }

      if (message.role !== 'user' && message.role !== 'assistant') {
        return false
      }

      if (message.role === 'assistant' && status !== 'ready') {
        return false
      }

      const text = getMessageText(message)
      if (!text.trim()) {
        return false
      }

      return true
    })

    if (messagesToPersist.length === 0) {
      return
    }

    ;(async () => {
      for (const message of messagesToPersist) {
        const content = getMessageText(message)
        try {
          const response = await fetch('/api/chat-history/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              messageId: message.id,
              role: message.role,
              content,
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to save message (${response.status})`)
          }

          persistedMessageIdsRef.current.add(message.id)
        } catch (error) {
          console.error('[chat] Failed to persist message to Supabase', error)
          persistenceDisabledRef.current = true
          toast.error('Chat history could not be saved. New messages will stay local.')
          return
        }
      }

      void mutate(CONVERSATION_LIST_KEY)
    })()
  }, [messages, activeConversationId, status])

  return (
    <Panel className={className}>
      <PanelHeader>
        <div className="flex items-center font-mono font-semibold uppercase">
          <MessageCircleIcon className="mr-2 w-4" />
          Chat
        </div>
        <div className="ml-auto font-mono text-xs opacity-50">[{status}]</div>
      </PanelHeader>

      {messages.length === 0 ? (
        <div className="flex-1 min-h-0">
          <div className="flex flex-col justify-center items-center h-full font-mono text-sm text-muted-foreground">
            <p className="flex items-center font-semibold">
              Click and try one of these prompts:
            </p>
            <ul className="p-4 space-y-1 text-center">
              {TEST_PROMPTS.map((prompt, idx) => (
                <li
                  key={idx}
                  className="px-4 py-2 rounded-sm border border-dashed shadow-sm cursor-pointer border-border hover:bg-secondary/50 hover:text-primary"
                  onClick={() => validateAndSubmitMessage(prompt)}
                >
                  {prompt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <Conversation className="relative w-full">
          <ConversationContent className="space-y-4">
            {messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      <form
        className="flex items-center p-2 space-x-1 border-t border-primary/18 bg-background"
        onSubmit={(event) => {
          event.preventDefault()
          validateAndSubmitMessage(input)
        }}
      >
        <Settings />
        <ModelSelector />
        <Input
          className="w-full font-mono text-sm rounded-sm border-0 bg-background"
          disabled={status === 'streaming' || status === 'submitted'}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          value={input}
        />
        <Button type="submit" disabled={status !== 'ready' || !input.trim()}>
          <SendIcon className="w-4 h-4" />
        </Button>
      </form>
    </Panel>
  )
}
