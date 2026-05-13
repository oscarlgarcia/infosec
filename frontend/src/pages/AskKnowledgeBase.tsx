import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Client, Chat, Message, Agent, ClientRequest } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { CreateRequestModal } from '../components/CreateRequestModal';
import { ViewClientModal } from '../components/ViewClientModal';
import { ViewRequestModal } from '../components/ViewRequestModal';
import { Layout } from '../components/Layout';
import { FormattedMessage } from '../components/FormattedMessage';
import { useApi, API_URL } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import '../styles/App.css';

export function AskKnowledgeBase() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const apiFetch = useApi();
  const {
    chats, selectedChatId, messages, sendingConversations,
    selectChat, createChat, sendMessage, fetchChats, deleteChat, updateChat, setChatsFromContext,
  } = useChat();

  const isSelectedSending = selectedChatId ? !!sendingConversations[selectedChatId] : false;

  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [chatFilter, setChatFilter] = useState('');
  const [showCreateRequestModal, setShowCreateRequestModal] = useState(false);
  const [showViewClientModal, setShowViewClientModal] = useState(false);
  const [showViewRequestModal, setShowViewRequestModal] = useState(false);
  const [viewClientData, setViewClientData] = useState<Client | null>(null);
  const [viewRequestData, setViewRequestData] = useState<ClientRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [addedMsgIds, setAddedMsgIds] = useState<Set<number>>(new Set());
  const [addingMsgId, setAddingMsgId] = useState<number | null>(null);
  const isFirstClientMount = useRef(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await apiFetch('/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data);
          if (data.length > 0 && !selectedAgent) {
            setSelectedAgent(data[0]);
          }
        }
      } catch (err) {
        console.error('Error loading agents:', err);
      }
    };
    loadAgents();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      setShowScrollButton(!isAtBottom);
    }
  }, []);

  const handleAddMsgToKB = async (msg: Message, idx: number) => {
    if (addedMsgIds.has(idx)) return;
    setAddingMsgId(idx);
    try {
        const userMsg = [...messages.slice(0, idx)].reverse().find(m => m.role === 'user');
        const res = await apiFetch('/kb/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: userMsg?.content || 'From chat',
            suggestedAnswer: msg.content,
            sessionId: selectedChatId,
            clientId: selectedClientId,
          }),
        });
      if (res.ok) {
        setAddedMsgIds(prev => new Set([...prev, idx]));
      }
    } catch (e) {
      console.error('Failed to add to KB:', e);
    } finally {
      setAddingMsgId(null);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchRequests(selectedClientId);
    } else {
      setRequests([]);
      setSelectedRequestId('');
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedClientId && selectedRequestId) {
      fetchChats(selectedClientId, selectedRequestId);
    } else if (selectedClientId) {
      fetchChats(selectedClientId);
    } else {
      setChatsFromContext([]);
    }
    if (isFirstClientMount.current) {
      isFirstClientMount.current = false;
      return;
    }
    selectChat(null);
    navigate('/chat', { replace: true });
  }, [selectedClientId, selectedRequestId]);

  useEffect(() => {
    if (conversationId && conversationId !== selectedChatId) {
      selectChat(conversationId);
    }
  }, [conversationId]);

  const fetchClients = async () => {
    try {
      const res = await apiFetch('/clients');
      if (!res.ok) throw new Error(`Error fetching clients: ${res.status}`);
      const data = await res.json();
      setClients(data);
      if (data.length === 0 && !selectedClientId) {
        const createRes = await apiFetch('/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Default Client',
            clientType: 'Cloud',
          }),
        });
        if (createRes.ok) {
          const newClient = await createRes.json();
          setClients([newClient]);
          setSelectedClientId(newClient.id);
        }
      } else if (data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchRequests = async (clientId: string) => {
    try {
      const res = await apiFetch(`/clients/${clientId}/requests`);
      if (!res.ok) throw new Error(`Error fetching requests: ${res.status}`);
      const data = await res.json();
      setRequests(data);
    } catch (err) {
      console.error('Error fetching requests:', err);
    }
  };

  const handleCreateClient = async (data: { name: string; clientType: string; country?: string; contact?: string }) => {
    try {
      const res = await apiFetch('/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error creating client: ${res.status}`);
      const newClient = await res.json();
      setClients(prev => [newClient, ...prev]);
      setSelectedClientId(newClient.id);
      return newClient;
    } catch (err) {
      console.error('Error creating client:', err);
      throw err;
    }
  };

  const handleCreateRequest = async (clientId: string, data: { requestType: string; sectionToReview?: string; deadline?: string; owner?: string; comments?: string }) => {
    try {
      const res = await apiFetch(`/clients/${clientId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`Error creating request: ${res.status}`);
      const newRequest = await res.json();
      setRequests(prev => [newRequest, ...prev]);
      setSelectedRequestId(newRequest.id);
    } catch (err) {
      console.error('Error creating request:', err);
    }
  };

  const handleNewChat = async () => {
    if (!selectedClientId) return;
    const chat = await createChat(selectedClientId, selectedAgent?.name || 'InfoSec', selectedRequestId);
    if (chat) {
      navigate(`/chat/${chat.id}`);
    }
  };

  const handleSelectChat = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleDeleteChat = async (chatId: string) => {
    await deleteChat(chatId);
    setActiveMenu(null);
    navigate('/chat', { replace: true });
  };

  const handleToggleFavorite = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    await updateChat(chatId, { favorite: !chat.favorite });
    setActiveMenu(null);
  };

  const handleStartRename = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
    setActiveMenu(null);
  };

  const handleSaveRename = async (chatId: string) => {
    if (!editingTitle.trim()) {
      setEditingChatId(null);
      setEditingTitle('');
      return;
    }
    await updateChat(chatId, { title: editingTitle.trim() });
    setEditingChatId(null);
    setEditingTitle('');
  };

  const toggleMenu = (chatId: string) => {
    setActiveMenu(activeMenu === chatId ? null : chatId);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedChatId || isSelectedSending) return;
    const content = inputValue;
    setInputValue('');
    sendMessage(selectedChatId, content, selectedAgent?.name || 'InfoSec');
  };

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(chatFilter.toLowerCase())
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const bringToInput = (text: string) => {
    setInputValue(text);
    setTimeout(() => {
      const textarea = document.querySelector('.chat-input') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
    }, 0);
  };

  const sidebarContent = (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">{t('conversations')}</span>
        {clients.length > 0 && (
          <button
            className="new-chat-btn"
            onClick={() => setShowCreateRequestModal(true)}
            style={{ marginTop: 8 }}
          >
            + {t('newRequest')}
          </button>
        )}
        {clients.length > 0 && (
          <div className="sidebar-controls">
            <label className="clients-label">{t('clients')}</label>
            <select
              className="client-dropdown"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">{t('selectClient')}</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {clients.length > 0 && requests.length > 0 && (
          <div className="sidebar-controls">
            <label className="clients-label">{t('requests') || 'Requests'}</label>
            <select
              className="client-dropdown"
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
            >
              <option value="">All Requests</option>
              {requests.map(req => (
                <option key={req.id} value={req.id}>
                  {req.requestKey} - {req.requestType}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="chat-filter">
        <input
          type="text"
          placeholder={t('filter')}
          value={chatFilter}
          onChange={(e) => setChatFilter(e.target.value)}
        />
      </div>

      <div className="chat-list">
        {filteredChats.map(chat => (
          <div key={chat.id} className={`chat-item ${selectedChatId === chat.id ? 'active' : ''}`}>
            {editingChatId === chat.id ? (
              <input
                className="chat-title-input"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleSaveRename(chat.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename(chat.id);
                  if (e.key === 'Escape') setEditingChatId(null);
                }}
                autoFocus
              />
            ) : (
              <>
                <span className="chat-icon" onClick={() => handleSelectChat(chat.id)}>
                  {sendingConversations[chat.id] ? '⏳' : '💬'}
                </span>
                <span className="chat-title" onClick={() => handleSelectChat(chat.id)}>
                  {chat.favorite && <span className="favorite-star">⭐</span>}
                  {chat.title}
                </span>
                <div className="chat-actions">
                  <button className="chat-actions-btn" onClick={() => toggleMenu(chat.id)}>
                    ⋮
                  </button>
                  {activeMenu === chat.id && (
                    <div className="chat-actions-menu">
                      <button onClick={() => handleStartRename(chat)}>✏️ {t('rename')}</button>
                      <button onClick={() => handleToggleFavorite(chat.id)}>
                        {chat.favorite ? `☆ ${t('removeFavorite')}` : `⭐ ${t('favorite')}`}
                      </button>
                      <button className="delete-btn" onClick={() => handleDeleteChat(chat.id)}>🗑️ {t('delete')}</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );

  const chatContent = (
    <>
      {selectedClientId && selectedClient && (
        <div className="client-info-bar">
          <div className="client-info-header">
            <span className="client-info-icon">👤</span>
            <span className="client-info-name">{selectedClient.name}</span>
          </div>
          <div className="client-info-details">
            <span className="client-info-type">{selectedClient.clientType}</span>
            {selectedClient.country && (
              <span className="client-info-request">{selectedClient.country}</span>
            )}
            {selectedClient.contact && (
              <span className="client-info-deadline">
                📞 {selectedClient.contact}
              </span>
            )}
          </div>
          <div className="client-info-actions">
            {selectedRequestId && (
              <>
                <button
                  className="client-info-new-chat-btn"
                  onClick={handleNewChat}
                >
                  + {t('newChat')}
                </button>
                <button
                  className="client-info-edit-btn"
                  onClick={async () => {
                    const res = await apiFetch(`/requests/${selectedRequestId}`);
                    if (!res.ok) throw new Error(`Error fetching request: ${res.status}`);
                    const data = await res.json();
                    setViewRequestData(data);
                    setShowViewRequestModal(true);
                  }}
                >
                  Ver {requests.find(r => r.id === selectedRequestId)?.requestType || 'Solicitud'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {selectedChatId ? (
        <>
          <div className="messages-container" ref={messagesContainerRef} onScroll={handleScroll}>
            {loading ? (
              <div className="empty-state">
                <div className="empty-text">{t('loading')}</div>
              </div>
            ) : messages.length === 0 && !isSelectedSending ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <div className="empty-title">{t('newConversation')}</div>
                <div className="empty-text">
                  {t('sendMessage')} {selectedAgent?.displayName || selectedAgent?.name || 'InfoSec'}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, idx) => (
                  <div key={idx} className={`message ${message.role}`}>
                    {message.role === 'assistant' ? (
                      <FormattedMessage message={message} />
                    ) : (
                      <div className="message-content">{message.content}</div>
                    )}
                    <div className="message-footer">
                      <div className="message-time">
                        {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                      </div>
                      <div className="message-actions">
                        {message.role === 'user' && (
                          <>
                            <button
                              className="msg-action-btn"
                              onClick={() => copyToClipboard(message.content)}
                              title="Copiar al portapapeles"
                            >
                              📋
                            </button>
                            <button
                              className="msg-action-btn"
                              onClick={() => bringToInput(message.content)}
                              title="Llevar al chat input"
                            >
                              ✏️
                            </button>
                          </>
                        )}
                        {message.role === 'assistant' && (
                          <button
                            className="msg-action-btn"
                            onClick={() => copyToClipboard(message.content)}
                            title="Copiar respuesta"
                          >
                            📋
                          </button>
                        )}
                        {message.role === 'assistant' && (
                          <button
                            className={`msg-add-kb-btn ${addedMsgIds.has(idx) ? 'added' : ''}`}
                            onClick={() => handleAddMsgToKB(message, idx)}
                            disabled={addingMsgId === idx}
                            title="Add to KB Candidates"
                          >
                            {addedMsgIds.has(idx) ? '✓' : '+'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isSelectedSending && (
                  <div className="message assistant">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          {showScrollButton && (
            <button className="scroll-to-bottom" onClick={scrollToBottom}>
              ↓
            </button>
          )}
          <div className="chat-input-area">
            <div className="chat-input-container">
              <div className="chat-input-header">
                <select
                  className="agent-selector-in-line"
                  value={selectedAgent?.name || ''}
                  onChange={(e) => {
                    const agent = agents.find(a => a.name === e.target.value);
                    setSelectedAgent(agent || null);
                  }}
                >
                  {agents.map(agent => (
                    <option key={agent._id} value={agent.name}>
                      {agent.displayName || agent.name}
                      {agent.isSystem ? ' (System)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder={t('search')}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  className="search-btn"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isSelectedSending}
                >
                  {isSelectedSending ? t('loading') : t('search')}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">💬</div>
          <div className="empty-title">{t('selectConversation')}</div>
          <div className="empty-text">{t('orCreateNew')}</div>
        </div>
      )}
    </>
  );

  return (
    <Layout sidebarContent={sidebarContent}>
      <div className="chat-area">
        {chatContent}
      </div>

      <CreateRequestModal
        clients={clients}
        clientId={selectedClientId}
        isOpen={showCreateRequestModal}
        onClose={() => setShowCreateRequestModal(false)}
        onSubmit={handleCreateRequest}
        onCreateClient={handleCreateClient}
      />

      <ViewClientModal
        client={viewClientData}
        isOpen={showViewClientModal}
        onClose={() => { setShowViewClientModal(false); setViewClientData(null); }}
      />

      <ViewRequestModal
        request={viewRequestData}
        isOpen={showViewRequestModal}
        onClose={() => { setShowViewRequestModal(false); setViewRequestData(null); }}
        onUpdate={async (id, data) => {
          await apiFetch(`/requests/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          if (selectedClientId) fetchRequests(selectedClientId);
          const res = await apiFetch(`/requests/${id}`);
          if (res.ok) {
            const updatedData = await res.json();
            setViewRequestData(updatedData);
          }
        }}
        onUpload={async (requestId, files) => {
          for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            await apiFetch(`/requests/${requestId}/attachments`, {
              method: 'POST',
              body: formData,
            });
          }
          const res = await apiFetch(`/requests/${requestId}`);
          if (res.ok) {
            const updatedData = await res.json();
            setViewRequestData(updatedData);
          }
        }}
        downloadUrl={(path) => `${API_URL}${path}`}
      />
    </Layout>
  );
}
