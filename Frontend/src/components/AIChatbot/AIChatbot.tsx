import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiCpu, FiLoader, FiMessageSquare, FiPlus, FiSend, FiTrash2, FiUser, FiImage, FiX, FiCheckCircle, FiFileText } from 'react-icons/fi';
import Markdown from 'react-markdown';
import { useLocation } from 'react-router-dom';
import { fetchChatHistory, fetchSessionMessages, createSession, sendChatMessage, deleteSession, type ChatMessage, type ChatSession, type ChatResponse } from '../../api/chat';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { notifyError, notifySuccess } from '../../utils/notifications';
import { updateLivestockHealthEvent } from '../../api/livestockHealth';
import { generateTextPDF } from '../../utils/pdfGenerator';

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubble({ message, onSuggestionClick }: { message: ChatMessage; onSuggestionClick?: (text: string) => void }) {
  const isUser = String(message.sender).toLowerCase() === 'user';
  let displayContent = message.content || '';
  let suggestions: string[] = [];

  // Parse SUGGESTED_QUESTIONS
  if (!isUser) {
    const match = displayContent.match(/SUGGESTED_QUESTIONS:\s*(\[.*\])/s);
    if (match) {
      try {
        suggestions = JSON.parse(match[1]);
        displayContent = displayContent.replace(/SUGGESTED_QUESTIONS:\s*\[.*\]/s, '').trim();
      } catch (e) {
        // Ignore parse error
      }
    }
  }

  return (
    <div className={`mb-4 flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser ? (
        <div className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-1">
          <FiCpu />
        </div>
      ) : null}
      <div className={`max-w-[80%] flex flex-col items-${isUser ? 'end' : 'start'}`}>
        <div className={`rounded-2xl px-4 py-3 ${isUser ? 'rounded-tr-sm bg-emerald-600 text-white' : 'rounded-tl-sm border border-slate-700 bg-slate-800 text-slate-100'}`}>
          {message.image_url && (
            <div className="mb-2">
              <img src={message.image_url.startsWith('blob:') ? message.image_url : `http://localhost:5000${message.image_url}`} alt="Uploaded" className="rounded-lg max-h-60 object-cover" />
            </div>
          )}
          <div className={`whitespace-pre-wrap text-sm leading-relaxed ${isUser ? '' : 'markdown-body'}`}>
            {isUser ? displayContent : (
              <Markdown
                components={{
                  h3: ({ node, ...props }) => {
                    const text = String(props.children);
                    let icon = '📌';
                    let colorClass = 'text-emerald-400';
                    if (text.toLowerCase().includes('immediate action')) { icon = '⚡'; colorClass = 'text-[#FFC107]'; }
                    else if (text.toLowerCase().includes('chemical treatment')) { icon = '🧪'; colorClass = 'text-[#FF5252]'; }
                    else if (text.toLowerCase().includes('organic treatment')) { icon = '🌱'; colorClass = 'text-[#00C853]'; }
                    else if (text.toLowerCase().includes('future prevention')) { icon = '🛡️'; colorClass = 'text-blue-400'; }
                    else if (text.toLowerCase().includes('disease')) { icon = '🦠'; colorClass = 'text-[#FF5252]'; }

                    return (
                      <div className="flex items-center gap-2 mt-4 mb-2 pb-1 border-b border-slate-700/50">
                        <span className="text-lg">{icon}</span>
                        <h3 className={`text-base font-bold uppercase tracking-wider ${colorClass}`} {...props} />
                      </div>
                    );
                  },
                  ul: ({ node, ...props }) => <ul className="space-y-2 my-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50" {...props} />,
                  li: ({ node, ...props }) => (
                    <li className="flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 mt-0.5"><FiCheckCircle size={14} /></span>
                      <span>{props.children}</span>
                    </li>
                  ),
                  strong: ({ node, ...props }) => {
                    const text = String(props.children);
                    // Apply glowing alert style if it's strongly identifying a disease
                    if (text.toLowerCase().includes('confidence') || text.toLowerCase().includes('detected')) {
                      return <strong className="text-white bg-slate-700/50 px-1.5 py-0.5 rounded font-extrabold" {...props} />;
                    }
                    return <strong className="font-bold text-white" {...props} />;
                  }
                }}
              >
                {displayContent}
              </Markdown>
            )}
          </div>
          <span className="mt-1 block text-right text-[10px] opacity-50">{formatTime(message.created_at)}</span>
        </div>
        {!isUser && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                onClick={() => onSuggestionClick && onSuggestionClick(sug)}
                className="text-xs bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-300 px-3 py-1.5 rounded-full transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        )}
      </div>
      {isUser ? (
        <div className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-slate-200 mt-1">
          <FiUser />
        </div>
      ) : null}
    </div>
  );
}

export default function AIChatbot() {
  const location = useLocation();
  const stateData = location.state as { crop?: string; predictedDisease?: string; confidence?: number; top_3?: any[]; imageUrl?: string; livestockSymptoms?: string; animal?: string; eventId?: string; detectionId?: string } | null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<ChatResponse['weather'] | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventIdRef = useRef<string | null>(stateData?.eventId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const history = await fetchChatHistory();
      setSessions(history);
      if (history.length > 0 && !activeSessionId) {
        const latestId = history[0].id;
        setActiveSessionId(latestId);
        const msgs = await fetchSessionMessages(latestId);
        setMessages(msgs);
      }
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

  // Handle auto-trigger from Disease Detection module or Livestock Health History
  useEffect(() => {
    if ((stateData?.crop || stateData?.livestockSymptoms) && !initializing && !loading) {
      let autoPrompt = "";

      if (stateData.livestockSymptoms) {
        autoPrompt = `My livestock (${stateData.animal || 'Animal'}) has the following symptoms: ${stateData.livestockSymptoms}. What disease could this be, what is the recommended treatment, causes, feeding/water requirements, and do we need to consider a doctor?`;
      } else if (stateData.confidence !== undefined && stateData.confidence < 60 && stateData.top_3) {
        const top3Str = stateData.top_3.map((p: any, i: number) => `${i + 1}. ${p.disease} (${p.confidence.toFixed(1)}%)`).join(', ');
        autoPrompt = `I tried to scan an image of my ${stateData.crop} but the AI had low confidence. Its top guesses were: ${top3Str}. Can you help me identify the problem and what I should do?`;
      } else if (stateData.predictedDisease) {
        autoPrompt = `I need help with my ${stateData.crop} crop. The AI detected ${stateData.predictedDisease} with ${stateData.confidence}% confidence. What should I do? Please explain what this disease is, what the reasons for it are, and suggest fertilizers or treatments.`;
      }

      if (autoPrompt) {
        const initiateChatWithImage = async () => {
          let imageFile: File | undefined = undefined;
          if (stateData.imageUrl) {
            try {
              const urlToFetch = stateData.imageUrl.startsWith('http') || stateData.imageUrl.startsWith('blob')
                ? stateData.imageUrl
                : `http://localhost:5000${stateData.imageUrl}`;
              const response = await fetch(urlToFetch);
              const blob = await response.blob();
              const filename = stateData.imageUrl.split('/').pop() || 'disease_image.jpg';
              imageFile = new File([blob], filename, { type: blob.type });
            } catch (err) {
              console.error("Failed to fetch image for chat", err);
            }
          }

          const title = stateData.crop
            ? `${stateData.crop}: ${stateData.predictedDisease || 'Advice'}`
            : 'New Conversation';
          await handleNewChat(
            autoPrompt,
            stateData.crop,
            stateData.predictedDisease,
            stateData.confidence,
            imageFile,
            stateData.detectionId,
            title
          );
          // clear state to prevent re-triggering
          window.history.replaceState({}, document.title);
        };

        void initiateChatWithImage();
      }
    }
  }, [stateData, initializing]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, loading]);

  const handleSelectSession = async (sessionId: string) => {
    if (loading) return;
    setActiveSessionId(sessionId);
    setLoading(true);
    try {
      const msgs = await fetchSessionMessages(sessionId);
      setMessages(msgs);
      setWeatherData(null); // reset weather on switch
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async (
    initialText?: string,
    cropCtx?: string,
    diseaseCtx?: string,
    confCtx?: number,
    initialFile?: File,
    detectionId?: string,
    sessionTitle?: string
  ) => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setWeatherData(null);
    setSelectedImage(null);
    setImagePreview(null);

    try {
      setLoading(true);
      const session = await createSession(sessionTitle || 'New Conversation', detectionId);
      setSessions(prev => prev.some(s => s.id === session.id) ? prev : [session, ...prev]);
      setActiveSessionId(session.id);

      // Coming back to a detection that already has a conversation: show what
      // was said before rather than asking the opening question a second time.
      if (session.reused) {
        const existing = await fetchSessionMessages(session.id);
        setMessages(existing);
        setLoading(false);
        inputRef.current?.focus();
        return;
      }

      if (initialText) {
        await sendMessage(initialText, session.id, initialFile, cropCtx, diseaseCtx, confCtx);
      } else {
        setLoading(false);
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    try {
      await deleteSession(sessionToDelete);
      notifySuccess('Conversation deleted');
      setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
      if (activeSessionId === sessionToDelete) {
        setActiveSessionId(null);
        setMessages([]);
      }
    } catch (err: any) {
      notifyError(err.message || 'Failed to delete');
    } finally {
      setDeleteConfirmOpen(false);
      setSessionToDelete(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async (text: string, overrideSessionId?: string, file?: File, cropCtx?: string, diseaseCtx?: string, confCtx?: number) => {
    const trimmed = text.trim();
    if ((!trimmed && !file && !selectedImage) || loading) return;

    const targetSessionId = overrideSessionId || activeSessionId;
    if (!targetSessionId) {
      return handleNewChat(trimmed);
    }

    const imgToUse = file || selectedImage;

    const tempUserId = crypto.randomUUID();
    const tempAiId = crypto.randomUUID();

    const userMessage: ChatMessage = {
      id: tempUserId,
      sender: 'user',
      content: trimmed,
      image_url: imgToUse ? URL.createObjectURL(imgToUse) : undefined,
      created_at: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    clearImage();
    setLoading(true);

    // Add empty AI message to stream into
    setMessages((current) => [
      ...current,
      { id: tempAiId, sender: 'ai', content: '', created_at: new Date().toISOString() }
    ]);

    try {
      await sendChatMessage(trimmed, targetSessionId, imgToUse || undefined, cropCtx, diseaseCtx, confCtx, {
        onMetadata: (data) => {
          if (data.weather) setWeatherData(data.weather);
        },
        onChunk: (chunk) => {
          setMessages((current) =>
            current.map(msg =>
              msg.id === tempAiId ? { ...msg, content: msg.content + chunk } : msg
            )
          );
          // scroll to bottom while streaming
          bottomRef.current?.scrollIntoView({ behavior: 'auto' });
        },
        onDone: async (finalMsg) => {
          setMessages((current) =>
            current.map(msg =>
              msg.id === tempAiId ? finalMsg : msg
            )
          );
          loadHistory(); // reload history to update titles if changed

          if (eventIdRef.current && finalMsg.content) {
            try {
              // Attempt to extract diagnosis and treatment
              const diagnosisMatch = finalMsg.content.match(/(?:### |\*\*)?(?:Disease Identification|Diagnosis|Disease):?(?:\*\*)?\s*\n?([^\n]+)/i);
              const treatmentMatch = finalMsg.content.match(/(?:### |\*\*)?(?:Treatment|Recommended Treatment|Immediate Action):?(?:\*\*)?\s*\n?([\s\S]+?)(?=\n###|\n\*\*|$)/i);

              let diagnosis = diagnosisMatch ? diagnosisMatch[1].replace(/\*\*/g, '').trim() : 'AI Diagnosis Available in Chat';
              let treatment = treatmentMatch ? treatmentMatch[1].replace(/\*\*/g, '').trim() : 'Please check AI response for treatment details.';

              // Fallback if regex misses but we have content
              if (!diagnosisMatch && !treatmentMatch) {
                diagnosis = 'AI Reviewed';
                treatment = finalMsg.content.substring(0, 500) + '...';
              }

              await updateLivestockHealthEvent(eventIdRef.current, { diagnosis, treatment });
              notifySuccess('Treatment Review Report Generated');
            } catch (err) {
              console.error('Failed to auto-update event review report', err);
            }
          }
        },
        onError: (err) => {
          throw err;
        }
      });
    } catch (error: any) {
      setMessages((current) =>
        current.map(msg =>
          msg.id === tempAiId ? { ...msg, content: error?.message ? `Error: ${error.message}` : 'Error: Failed to reach the SmartFarm AI advisor.' } : msg
        )
      );
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
      <div className="flex h-full items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
        <FiLoader className="animate-spin text-3xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-800 bg-slate-950 md:flex">
        <div className="p-4">
          <button
            type="button"
            onClick={() => handleNewChat()}
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
          {historyLoading && sessions.length === 0 ? (
            <div className="px-2 py-4 text-sm text-slate-500">Loading history...</div>
          ) : sessions.length === 0 ? (
            <div className="px-2 py-4 text-sm italic text-slate-600">No history yet</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`mb-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer group ${activeSessionId === session.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                onClick={() => handleSelectSession(session.id)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <FiMessageSquare className="shrink-0 opacity-70" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSessionToDelete(session.id); setDeleteConfirmOpen(true); }}
                  className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-500 transition-opacity"
                  title="Delete conversation"
                >
                  <FiTrash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col bg-slate-900" id="ai-chat-content">
        <header className="absolute top-0 z-10 flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <FiCpu className="text-xl text-emerald-500" />
            <div>
              <h3 className="font-semibold text-slate-100">SmartFarm AI Advisor</h3>
              <p className="text-xs text-slate-400">{activeSession?.title || 'New conversation'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {weatherData && (
              <div className="flex items-center gap-3 text-xs bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-slate-300">
                <span>Temp: {weatherData.temperature}°C</span>
                <span>Humidity: {weatherData.humidity}%</span>
                <span>{weatherData.condition}</span>
              </div>
            )}
            <button
              onClick={() => {
                const title = `AI Advisory Report: ${activeSession?.title || 'General'}`;

                const aiMessages = messages.filter(m => m.sender !== 'user');
                let content = '';
                if (aiMessages.length > 0) {
                  content = aiMessages[0].content.replace(/SUGGESTED_QUESTIONS:\s*\[.*?\]/gs, '').trim();
                }

                generateTextPDF(title, content || 'No advice generated yet.', `AI_Advisory_${activeSession?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Report'}`);
              }}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-slate-700 hover:text-emerald-300 border border-emerald-500/30"
              title="Download chat text as PDF"
            >
              <FiFileText />
              Generate PDF
            </button>
          </div>
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
            messages.map((message) => <MessageBubble key={message.id} message={message} onSuggestionClick={(sug) => void sendMessage(sug)} />)
          )}

          {loading && messages.length > 0 && messages[messages.length - 1].content === '' ? (
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
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              <img src={imagePreview} alt="Preview" className="h-16 w-16 object-cover rounded-md border border-slate-700" />
              <button onClick={clearImage} className="absolute -top-2 -right-2 bg-slate-700 rounded-full p-1 text-white hover:bg-rose-500">
                <FiX size={12} />
              </button>
            </div>
          )}
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-slate-700 bg-slate-800 p-1 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50">
            <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mb-1 ml-1 rounded-xl p-3 text-slate-400 transition-colors hover:text-emerald-400"
            >
              <FiImage size={20} />
            </button>
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
              disabled={loading || (!input.trim() && !selectedImage)}
              className="mb-1 mr-1 rounded-xl bg-emerald-600 p-3 text-white transition-colors hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {loading && !messages.find(m => m.content === '') ? <FiLoader className="animate-spin" /> : <FiSend />}
            </button>
          </div>
          <div className="mt-2 text-center text-[10px] text-slate-500">
            AI can make mistakes. Verify important farming decisions. Weather data is factored into advisory answers.
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Conversation"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
}

