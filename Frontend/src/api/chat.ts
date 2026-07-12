import { apiFetch } from '../utils/apiFetch';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'USER' | 'AI';
  content: string; // Updated from 'message' to 'content'
  image_url?: string;
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
  message: ChatMessage;
  weather?: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    rainProb: number;
    condition: string;
  };
}

async function handleJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
  }
  return payload as T;
}

export async function fetchChatHistory() {
  const response = await apiFetch('/api/chat/sessions');
  const sessions = await handleJson<ChatSession[]>(response);
  
  // We need to fetch messages for each session if they are not included
  // But for performance, we can just fetch messages when a session is selected.
  return sessions;
}

export async function fetchSessionMessages(sessionId: string) {
  const response = await apiFetch(`/api/chat/sessions/${sessionId}/messages`);
  return handleJson<ChatMessage[]>(response);
}

export async function createSession(title?: string) {
  const response = await apiFetch('/api/chat/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return handleJson<ChatSession>(response);
}

export async function sendChatMessage(
  content: string,
  sessionId: string,
  file?: File,
  cropContext?: string,
  diseaseContext?: string,
  confidenceContext?: number,
  callbacks?: {
    onMetadata?: (data: { message: ChatMessage; weather: any }) => void;
    onChunk?: (text: string) => void;
    onDone?: (message: ChatMessage) => void;
    onError?: (error: Error) => void;
  }
) {
  const formData = new FormData();
  formData.append('sessionId', sessionId);
  if (content) formData.append('content', content);
  if (file) formData.append('image', file);
  if (cropContext) formData.append('cropContext', cropContext);
  if (diseaseContext) formData.append('diseaseContext', diseaseContext);
  if (confidenceContext) formData.append('confidenceContext', confidenceContext.toString());

  try {
    const response = await apiFetch('/api/chat/message', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed with status ${response.status}`);
    }

    if (!callbacks) {
        // Fallback for non-streaming calls, though everything should use streaming now.
        return handleJson<ChatResponse>(response);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is not readable');

    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === 'metadata' && callbacks.onMetadata) {
                callbacks.onMetadata({ message: data.message, weather: data.weather });
              } else if (data.type === 'chunk' && callbacks.onChunk) {
                callbacks.onChunk(data.text);
              } else if (data.type === 'done' && callbacks.onDone) {
                callbacks.onDone(data.message);
              } else if (data.type === 'error' && callbacks.onError) {
                callbacks.onError(new Error(data.text));
              }
            } catch (e) {
              // Ignore parse errors on incomplete chunks
            }
          }
        }
      }
    }
  } catch (error: any) {
    if (callbacks?.onError) {
      callbacks.onError(error);
    } else {
      throw error;
    }
  }
}

export async function deleteSession(sessionId: string) {
    const response = await apiFetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
    });
    return handleJson<{ message: string }>(response);
}
