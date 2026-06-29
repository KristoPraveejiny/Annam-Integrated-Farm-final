import { apiFetch } from '../utils/apiFetch';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'USER' | 'AI';
  message: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  session: {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
  };
  reply: string;
  language: string;
  weather?: unknown;
  messages: ChatMessage[];
}

async function handleJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload as T;
}

export async function fetchChatHistory() {
  const response = await apiFetch('/api/chat/history');
  return handleJson<ChatSession[]>(response);
}

export async function sendChatMessage(message: string, sessionId?: string | null) {
  const response = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId: sessionId || undefined }),
  });
  return handleJson<ChatResponse>(response);
}

export async function deleteChatSession(sessionId: string) {
  const response = await apiFetch(`/api/chat/session/${sessionId}`, {
    method: 'DELETE',
  });
  return handleJson<{ message: string }>(response);
}
