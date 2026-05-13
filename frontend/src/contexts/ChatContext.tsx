import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { Chat, Message, Conversation } from '../types';
import { useApi } from './AuthContext';

interface ChatContextValue {
  chats: Chat[];
  selectedChatId: string | null;
  messages: Message[];
  sendingConversations: Record<string, boolean>;
  isConversationSending: (id: string) => boolean;
  selectChat: (id: string | null) => Promise<void>;
  createChat: (clientId: string, agent: string, requestId?: string) => Promise<Chat | null>;
  sendMessage: (conversationId: string, content: string, agent: string) => void;
  fetchChats: (clientId: string, requestId?: string) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  updateChat: (id: string, data: Partial<Chat>) => Promise<Chat | null>;
  setChatsFromContext: (chats: Chat[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const apiFetch = useApi();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sendingConversations, setSendingConversations] = useState<Record<string, boolean>>({});
  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => { selectedChatIdRef.current = selectedChatId; }, [selectedChatId]);

  const isConversationSending = useCallback((id: string): boolean => {
    return !!sendingConversations[id];
  }, [sendingConversations]);

  const fetchChats = useCallback(async (clientId: string, requestId?: string) => {
    try {
      const url = requestId
        ? `/conversations?clientId=${clientId}&requestId=${requestId}`
        : `/conversations?clientId=${clientId}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error(`Error fetching chats: ${res.status}`);
      const data = await res.json();
      setChats(data);
    } catch (err) {
      console.error('Error fetching chats:', err);
    }
  }, [apiFetch]);

  const selectChat = useCallback(async (id: string | null) => {
    setSelectedChatId(id);
    if (!id) {
      setMessages([]);
      return;
    }
    try {
      const res = await apiFetch(`/conversations/${id}`);
      if (!res.ok) throw new Error(`Error fetching messages: ${res.status}`);
      const data: Conversation = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, [apiFetch]);

  const createChat = useCallback(async (clientId: string, agent: string, requestId?: string): Promise<Chat | null> => {
    try {
      const res = await apiFetch('/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          requestId: requestId || undefined,
          title: 'Nueva conversación',
          agent,
        }),
      });
      if (!res.ok) throw new Error(`Error creating chat: ${res.status}`);
      const newChat = await res.json();
      setChats(prev => [newChat, ...prev]);
      return newChat;
    } catch (err) {
      console.error('Error creating chat:', err);
      return null;
    }
  }, [apiFetch]);

  const sendMessage = useCallback((conversationId: string, content: string, agent: string) => {
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setSendingConversations(prev => ({ ...prev, [conversationId]: true }));

    const doSend = async () => {
      try {
        const res = await apiFetch(`/conversations/${conversationId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: content, agent }),
        });
        if (!res.ok) throw new Error(`Error sending message: ${res.status}`);
        const data = await res.json();
        if (selectedChatIdRef.current === conversationId) {
          setMessages(data.conversation.messages || []);
        }
      } catch (err) {
        console.error('Error sending message:', err);
        if (selectedChatIdRef.current === conversationId) {
          const isTimeout = err instanceof Error && (err.message.includes('504') || err.message.includes('Gateway Time-out'));
          const assistantMessage: Message = {
            role: 'assistant',
            content: isTimeout
              ? 'La solicitud está tomando más tiempo de lo esperado. Intente nuevamente.'
              : `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      } finally {
        setSendingConversations(prev => ({ ...prev, [conversationId]: false }));
      }
    };

    doSend();
  }, [apiFetch]);

  const deleteChat = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Error deleting chat: ${res.status}`);
      setChats(prev => prev.filter(c => c.id !== id));
      if (selectedChatId === id) {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  }, [apiFetch, selectedChatId]);

  const updateChat = useCallback(async (id: string, data: Partial<Chat>): Promise<Chat | null> => {
    try {
      const res = await apiFetch(`/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error updating chat: ${res.status}`);
      const updated = await res.json();
      setChats(prev => prev.map(c => c.id === id ? updated : c));
      return updated;
    } catch (err) {
      console.error('Error updating chat:', err);
      return null;
    }
  }, [apiFetch]);

  const setChatsFromContext = useCallback((newChats: Chat[]) => {
    setChats(newChats);
  }, []);

  return (
    <ChatContext.Provider value={{
      chats, selectedChatId, messages, sendingConversations, isConversationSending,
      selectChat, createChat, sendMessage, fetchChats, deleteChat, updateChat,
      setChatsFromContext,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
