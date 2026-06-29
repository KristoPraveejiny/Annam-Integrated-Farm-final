import {
  buildFarmSnapshotForUser,
  createChatSession,
  deleteChatSessionForUser,
  generateChatReply,
  getChatMessages,
  getChatSessionForUser,
  insertChatMessage,
  listChatSessions,
  renameChatSession,
} from '../services/aiService.js';

function getConversationMessages(messages = []) {
  return messages
    .filter((message) => {
      const sender = String(message.sender || '').toLowerCase();
      return sender === 'user' || sender === 'ai';
    })
    .map((message) => ({
      role: String(message.sender || '').toLowerCase() === 'user' ? 'user' : 'assistant',
      content: message.message,
    }));
}

function buildChatTitle(message) {
  const words = String(message || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  if (words.length === 0) return 'New chat';
  const title = words.join(' ');
  return title.length > 40 ? `${title.slice(0, 37).trim()}...` : title;
}

export async function postChatMessage(req, res) {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { message, sessionId } = req.body;
    const { farmId } = await buildFarmSnapshotForUser(userId);

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let session = null;
    if (sessionId) {
      session = await getChatSessionForUser(userId, farmId, sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
    } else {
      session = await createChatSession(userId, farmId, buildChatTitle(message));
    }

    const previousMessages = await getChatMessages(session.id);
    const conversation = getConversationMessages(previousMessages).slice(-12);
    await insertChatMessage(session.id, 'user', message.trim());

    const result = await generateChatReply({
      userId,
      role,
      userMessage: message.trim(),
      conversation,
    });

    const aiMessage = await insertChatMessage(session.id, 'ai', result.reply);

    if (!session.title || session.title === 'New chat') {
      session = await renameChatSession(session.id, buildChatTitle(message));
    }

    const messages = await getChatMessages(session.id);

    res.status(201).json({
      session: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
      reply: aiMessage.message,
      language: result.language,
      weather: result.farmContext.weather,
      messages,
    });
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate a farming advisory response',
    });
  }
}

export async function getChatHistory(req, res) {
  try {
    const { farmId } = await buildFarmSnapshotForUser(req.user.userId);
    const sessions = await listChatSessions(req.user.userId, farmId);
    res.json(sessions);
  } catch (error) {
    console.error('Failed to load chat history:', error);
    res.status(500).json({ error: 'Failed to load chat history' });
  }
}

export async function deleteChatSession(req, res) {
  try {
    const { farmId } = await buildFarmSnapshotForUser(req.user.userId);
    const deleted = await deleteChatSessionForUser(req.user.userId, farmId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    res.json({ message: 'Chat session deleted' });
  } catch (error) {
    console.error('Failed to delete chat session:', error);
    res.status(500).json({ error: 'Failed to delete chat session' });
  }
}
