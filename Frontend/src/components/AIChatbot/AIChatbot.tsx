import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { FiSend, FiLoader, FiUser, FiCpu, FiMessageSquare, FiPlus, FiAlertCircle } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  sender: 'USER' | 'AI';
  message: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: Message[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const DJANGO_API_BASE = 'http://127.0.0.1:8000';

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Single Message Bubble ────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.sender === 'USER';
  const isError = msg.sender === 'ERROR' as any;

  return (
    <div className={`chat-message-row ${isUser ? 'chat-message-row--user' : 'chat-message-row--ai'} mb-4 flex w-full`}>
      {/* Avatar */}
      {!isUser && (
        <div className={`chat-avatar shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 ${isError ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {isError ? <FiAlertCircle /> : <FiCpu />}
        </div>
      )}

      {/* Bubble */}
      <div className={`chat-bubble max-w-[80%] rounded-2xl px-4 py-2 ${isUser ? 'bg-emerald-600 text-white ml-auto rounded-tr-sm' : isError ? 'bg-red-950 text-red-200 border border-red-800' : 'bg-slate-800 text-slate-200 rounded-tl-sm'}`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
        <span className="text-[10px] opacity-50 mt-1 block text-right">{formatTime(msg.timestamp)}</span>
      </div>

      {isUser && (
        <div className="chat-avatar shrink-0 w-8 h-8 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center ml-3">
          <FiUser />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIChatbot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch History
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setInitializing(false);
        return;
      }
      try {
        const res = await fetch(`${DJANGO_API_BASE}/api/chat/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSessions(data);
          if (data.length > 0) {
            setActiveSessionId(data[0].id);
            setMessages(data[0].messages || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
      } finally {
        setInitializing(false);
      }
    };
    fetchHistory();
  }, []);

  // Handle Session Change
  const handleSelectSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages || []);
    }
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Send message
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const userMsg: Message = { id: Math.random().toString(), sender: 'USER', message: trimmed, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${DJANGO_API_BASE}/api/chat/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chat_id: activeSessionId, message: trimmed }),
      });

      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      
      const aiMsg: Message = {
        id: Math.random().toString(),
        sender: 'AI',
        message: data.reply || 'Sorry, I could not generate a response.',
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
      // Update session list if new
      if (!activeSessionId && data.chat_id) {
        setActiveSessionId(data.chat_id);
        // re-fetch sessions to update list
        const histRes = await fetch(`${DJANGO_API_BASE}/api/chat/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (histRes.ok) setSessions(await histRes.json());
      }

    } catch (err: any) {
      const errorMsg: Message = {
        id: Math.random().toString(),
        sender: 'ERROR' as any,
        message: `Error: ${err.message || 'Failed to reach the AI server.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (initializing) {
    return <div className="h-[600px] flex items-center justify-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800"><FiLoader className="spin text-3xl" /></div>;
  }

  return (
    <div className="flex h-[600px] bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      
      {/* Sidebar - Chat History */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-4">
          <button 
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg transition-colors font-medium text-sm"
          >
            <FiPlus /> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 custom-scrollbar">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 ml-1 mt-2">Previous Chats</h4>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-600 italic px-2">No history</p>
          ) : (
            sessions.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeSessionId === s.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800/50'}`}
              >
                <FiMessageSquare className="shrink-0 opacity-70" />
                <span className="truncate">{s.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900 relative">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900/80 backdrop-blur-md absolute top-0 w-full z-10">
          <div className="flex items-center gap-3">
            <FiCpu className="text-emerald-500 text-xl" />
            <h3 className="font-semibold text-slate-200">Annam Smart Farm AI</h3>
          </div>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/20">OpenRouter</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto pt-20 pb-4 px-6 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto opacity-60">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <FiCpu className="text-3xl text-emerald-400" />
              </div>
              <h4 className="text-xl font-medium text-slate-200 mb-2">How can I help your farm today?</h4>
              <p className="text-sm text-slate-400">Ask about crop management, weather risks, pest control, or livestock care.</p>
            </div>
          ) : (
            messages.map((msg, i) => <MessageBubble key={msg.id || i} msg={msg} />)
          )}
          {loading && (
            <div className="chat-message-row chat-message-row--ai mb-4 flex w-full">
               <div className="chat-avatar shrink-0 w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-emerald-500/20 text-emerald-400">
                  <FiCpu />
               </div>
               <div className="chat-bubble bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
               </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
          <div className="relative max-w-4xl mx-auto flex items-end gap-2 bg-slate-800 border border-slate-700 rounded-2xl p-1 focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
            <textarea
              ref={inputRef}
              className="flex-1 max-h-32 bg-transparent text-slate-200 text-sm p-3 focus:outline-none resize-none custom-scrollbar"
              placeholder="Ask farm-related questions..."
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl mb-1 mr-1 transition-colors"
            >
              {loading ? <FiLoader className="spin" /> : <FiSend />}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-2">AI can make mistakes. Verify important farming decisions.</p>
        </div>
      </div>
    </div>
  );
}
