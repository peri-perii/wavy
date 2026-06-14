import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string          // client-side uuid for React key
  username: string
  content: string     // already DOMPurify-sanitized before storing
  timestamp: number
  isOwn: boolean      // true if sent by the current user
}

const BUFFER_SIZE = 100

interface ChatState {
  messages: ChatMessage[]
  unreadCount: number
  isPanelOpen: boolean

  // Actions
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  loadHistory: (msgs: Array<Omit<ChatMessage, 'id' | 'isOwn'>>, myUsername: string) => void
  markRead: () => void
  togglePanel: () => void
  clearChat: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

let idCounter = 0
function nextId(): string {
  return `msg-${Date.now()}-${++idCounter}`
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,
  isPanelOpen: false,

  addMessage: (msg) =>
    set((s) => {
      const newMsg: ChatMessage = { ...msg, id: nextId() }
      const messages = [...s.messages, newMsg]
      // Maintain rolling 100-message buffer client-side
      if (messages.length > BUFFER_SIZE) messages.shift()

      return {
        messages,
        unreadCount: s.isPanelOpen ? s.unreadCount : s.unreadCount + 1,
      }
    }),

  loadHistory: (msgs, myUsername) =>
    set({
      messages: msgs.map((m) => ({
        ...m,
        id: nextId(),
        isOwn: m.username === myUsername,
      })),
      unreadCount: 0,
    }),

  markRead: () => set({ unreadCount: 0 }),

  togglePanel: () =>
    set((s) => ({
      isPanelOpen: !s.isPanelOpen,
      unreadCount: !s.isPanelOpen ? 0 : s.unreadCount,
    })),

  clearChat: () => set({ messages: [], unreadCount: 0 }),
}))
