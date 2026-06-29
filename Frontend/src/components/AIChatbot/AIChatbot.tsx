import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiCpu, FiLoader, FiMessageSquare, FiPlus, FiSend, FiTrash2, FiUser } from 'react-icons/fi';
import { deleteChatSession, fetchChatHistory, sendChatMessage, type ChatMessage, type ChatSession } from '../../api/chat';

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSessionDate(timestamp: string) {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = String(message.sender).toLowerCase() === 'user';

  return (
    <div className={`mb-4 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <FiCpu />
        </div>
      ) : null}
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isUser ? 'rounded-tr-sm bg-emerald-600 text-white' : 'rounded-tl-sm border border-slate-700 bg-slate-800 text-slate-100'}`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.message}</p>
        <span className="mt-1 block text-right text-[10px] opacity-50">{formatTime(message.created_at)}</span>
      </div>
      {isUser ? (
        <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200">
          <FiUser />
        </div>
      ) : null}
    </div>
  );
}

export default function AIChatbot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );

  const loadHistory = async (preferredSessionId?: string | null) => {
    setHistoryLoading(true);
    try {
      const history = await fetchChatHistory();
      setSessions(history);
      const selectedId = preferredSessionId || activeSessionId || history[0]?.id || null;
      setActiveSessionId(selectedId);
      const selectedSession = history.find((session) => session.id === selectedId);
      setMessages(selectedSession?.messages || []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setHistoryLoading(false);
      setInitializing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setMessages(session.messages || []);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = window.confirm('Delete this conversation?');
    if (!confirmed) return;

    try {
      await deleteChatSession(sessionId);
      const remaining = sessions.filter((session) => session.id !== sessionId);
      setSessions(remaining);

      if (activeSessionId === sessionId) {
        const fallbackSession = remaining[0] || null;
        setActiveSessionId(fallbackSession?.id || null);
        setMessages(fallbackSession?.messages || []);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'USER',
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(trimmed, activeSessionId);
      const updatedMessages = response.messages || [];
      setMessages(updatedMessages);
      setActiveSessionId(response.session.id);

      setSessions((current) => {
        const nextSession: ChatSession = {
          id: response.session.id,
          title: response.session.title,
          created_at: response.session.created_at,
          updated_at: response.session.updated_at,
          messages: updatedMessages,
        };

        const withoutCurrent = current.filter((session) => session.id !== response.session.id);
        return [nextSession, ...withoutCurrent].sort((left, right) => {
          return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
        });
      });
    } catch (error: any) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: 'AI',
          message: error?.message ? `Error: ${error.message}` : 'Error: Failed to reach the SmartFarm AI advisor.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  if (initializing) {
    return (
      <div className="flex h-[600px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
        <FiLoader className="animate-spin text-3xl" />
      </div>
    );
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 md:flex">
        <div className="p-4">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <FiPlus />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="mb-2 ml-1 mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Previous Chats
          </div>
          {historyLoading ? (
            <div className="px-2 py-4 text-sm text-slate-500">Loading history...</div>
          ) : sessions.length === 0 ? (
            <div className="px-2 py-4 text-sm italic text-slate-600">No history yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeSessionId === session.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectSession(session.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <FiMessageSquare className="shrink-0 opacity-70" />
                  <span className="truncate">{session.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSession(session.id)}
                  className="rounded-md p-1 text-slate-500 transition hover:bg-slate-700 hover:text-rose-300"
                  aria-label={`Delete ${session.title}`}
                >
                  <FiTrash2 />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col bg-slate-900">
        <header className="absolute top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <FiCpu className="text-xl text-emerald-500" />
            <div>
              <h3 className="font-semibold text-slate-100">SmartFarm AI Advisor</h3>
              <p className="text-xs text-slate-400">{activeSession?.title || 'New conversation'}</p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">
            OpenRouter
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-20">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center opacity-70">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
                <FiCpu className="text-3xl text-emerald-400" />
              </div>
              <h4 className="mb-2 text-xl font-medium text-slate-200">How can I help your farm today?</h4>
              <p className="text-sm text-slate-400">
                Ask about crops, livestock, irrigation, weather risks, pests, fertilizer, or task planning.
              </p>
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}

          {loading ? (
            <div className="mb-4 flex w-full justify-start">
              <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <FiCpu />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-slate-800 px-4 py-3">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.2s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-800 bg-slate-900 p-4">
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-1 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none bg-transparent p-3 text-sm text-slate-200 focus:outline-none"
              placeholder="Ask a farm-related question..."
              rows={1}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={loading || !input.trim()}
              className="mb-1 mr-1 rounded-xl bg-emerald-600 p-3 text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {loading ? <FiLoader className="animate-spin" /> : <FiSend />}
            </button>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-500">
            AI can make mistakes. Verify important farming decisions.
          </div>
        </div>
      </section>
    </div>
  );
}
