'use client'

import { create } from 'zustand'

interface ChatHistoryState {
  activeConversationId: string | null
  activeConversationTitle: string | null
  setActiveConversation: (conversationId: string | null, title?: string | null) => void
  resetConversation: () => void
}

export const useChatHistoryStore = create<ChatHistoryState>((set) => ({
  activeConversationId: null,
  activeConversationTitle: null,
  setActiveConversation: (conversationId, title = null) =>
    set({
      activeConversationId: conversationId,
      activeConversationTitle: title ?? null,
    }),
  resetConversation: () => set({ activeConversationId: null, activeConversationTitle: null }),
}))
