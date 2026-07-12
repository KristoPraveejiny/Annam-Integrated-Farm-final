import { pool } from '../db.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getWeatherSummary, getWeatherByCity } from '../services/weatherService.js';
import { getDefaultFarmId } from './livestockController.js';

// Helper to convert image to base64
const getBase64Image = (filePath) => {
    const bitmap = fs.readFileSync(filePath);
    return Buffer.from(bitmap).toString('base64');
};

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Mock default location if none provided (e.g., center of farm)
const DEFAULT_LAT = 13.0827; // Example: Chennai
const DEFAULT_LON = 80.2707;

export const getSessions = async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query(
            'SELECT * FROM chat_sessions WHERE user_id = $1 ORDER BY updated_at DESC',
            [userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await pool.query(
            'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
            [sessionId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

export const createSession = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { title } = req.body;
        const result = await pool.query(
            'INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2) RETURNING *',
            [userId, title || 'New Conversation']
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
};

export const sendMessage = async (req, res) => {
    try {
        const { sessionId, cropContext, diseaseContext, confidenceContext } = req.body;
        const content = req.body.content || '';
        let imageUrl = null;
        let base64Image = null;

        if (req.file) {
            imageUrl = `/uploads/activities/${req.file.filename}`;
            base64Image = getBase64Image(req.file.path);
        }

        // 1. Save User Message
        const userInsert = await pool.query(
            'INSERT INTO chat_messages (session_id, sender, content, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
            [sessionId, 'user', content, imageUrl]
        );

        // Update session timestamp
        await pool.query('UPDATE chat_sessions SET updated_at = now() WHERE id = $1', [sessionId]);

        // 2. Fetch Weather
        let weatherData = null;
        try {
            const userId = req.user.userId;
            const farmId = await getDefaultFarmId(userId);
            const farmRes = await pool.query('SELECT latitude, longitude FROM farms WHERE id = $1', [farmId]);
            let weatherSummary = null;
            if (farmRes.rows.length > 0) {
              const { latitude, longitude } = farmRes.rows[0];
              if (latitude && longitude) {
                weatherSummary = await getWeatherSummary(latitude, longitude);
              }
            }
            if (!weatherSummary) {
              const defaultCity = process.env.DEFAULT_CITY || 'Vavuniya';
              weatherSummary = await getWeatherByCity(defaultCity);
            }
            if (weatherSummary) {
                weatherData = {
                    temperature: weatherSummary.temperature,
                    humidity: weatherSummary.humidity,
                    windSpeed: weatherSummary.windSpeed,
                    condition: weatherSummary.description
                };
            }
        } catch (weatherErr) {
            console.error('Error fetching weather:', weatherErr.message);
        }

        // 3. Construct Context for AI
        let systemPrompt = `You are a professional AI Farm Assistant for a Smart Farm Management System.
Your role is to assist users with farming-related questions and image-based advisory.
Focus on recommendations, weather, irrigation, fertilizer, livestock, harvesting, marketplace, and farm management.
DO NOT act as a CNN disease detection model (that is a separate module).
If the conversation originates from Disease Detection, use the provided disease prediction only as context. Never predict diseases yourself.
Always base your advice on the current weather if available. Format your responses using Markdown. Keep advice practical and actionable.

CRITICAL INSTRUCTION:
At the very end of your response, you MUST provide 3 suggested short follow-up questions the user could ask, formatted EXACTLY like this on a new line:
SUGGESTED_QUESTIONS: ["Question 1", "Question 2", "Question 3"]`;

        if (weatherData) {
            systemPrompt += `\n\nCURRENT WEATHER AT FARM:
Temperature: ${weatherData.temperature}°C
Humidity: ${weatherData.humidity}%
Wind Speed: ${weatherData.windSpeed} m/s
Condition: ${weatherData.condition}`;
        } else {
            systemPrompt += `\n\nCURRENT WEATHER AT FARM: Weather data currently unavailable. Give general advice.`;
        }

        if (cropContext && diseaseContext) {
            systemPrompt += `\n\nCONTEXT FROM DISEASE DETECTION MODULE:
The user just scanned a ${cropContext} leaf and the CNN model predicted '${diseaseContext}' with ${confidenceContext}% confidence.
Provide recommendations for managing this, but remember: use this prediction ONLY as context. Do not make predictions yourself.`;
        }

        // 4. Call OpenRouter
        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        // Fetch previous messages for context (limit to last 20 messages)
        const historyRes = await pool.query(
            'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 20',
            [sessionId]
        );
        const history = historyRes.rows.reverse();
        
        // Auto title generation if this is the first message in the session
        if (history.length === 1 && content) {
            // Run in background
            setTimeout(async () => {
                try {
                    if (OPENROUTER_API_KEY) {
                        const titleRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: 'google/gemini-2.5-flash',
                                max_tokens: 50,
                                messages: [{ role: 'user', content: `Generate a very short title (max 4 words) summarizing this message: "${content}"` }]
                            })
                        });
                        const titleData = await titleRes.json();
                        let newTitle = titleData.choices[0]?.message?.content?.trim() || 'New Conversation';
                        // Clean up quotes
                        newTitle = newTitle.replace(/^["']|["']$/g, '');
                        await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [newTitle, sessionId]);
                    }
                } catch (e) {
                    console.error('Error generating title:', e);
                }
            }, 100);
        }

        for (const msg of history) {
            if (msg.sender === 'user') {
                messages.push({ role: 'user', content: msg.content || "Uploaded an image." });
            } else {
                messages.push({ role: 'assistant', content: msg.content });
            }
        }

        // The current message is already in history, but we need to re-format it to include the image if present
        messages.pop(); // Remove the text-only version of the current user message that came from DB

        const userContent = [];
        if (content) {
            userContent.push({ type: 'text', text: content });
        }
        if (base64Image) {
            userContent.push({
                type: 'image_url',
                image_url: {
                    url: `data:${req.file.mimetype};base64,${base64Image}`
                }
            });
        }
        messages.push({ role: 'user', content: userContent });

        // Setup SSE response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Send initial metadata
        res.write(`data: ${JSON.stringify({ type: 'metadata', message: userInsert.rows[0], weather: weatherData })}\n\n`);

        let aiResponseText = "";

        if (OPENROUTER_API_KEY) {
            try {
                const fetchRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        max_tokens: 1000,
                        messages: messages,
                        stream: true
                    })
                });

                if (!fetchRes.ok) {
                    const errText = await fetchRes.text();
                    console.error('OpenRouter Error:', errText);
                    aiResponseText = "Sorry, the AI service experienced an error.";
                } else {
                    const reader = fetchRes.body.getReader();
                    const decoder = new TextDecoder("utf-8");
                    let done = false;

                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) {
                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                    try {
                                        const parsed = JSON.parse(line.substring(6));
                                        const delta = parsed.choices[0]?.delta?.content || "";
                                        if (delta) {
                                            aiResponseText += delta;
                                            res.write(`data: ${JSON.stringify({ type: 'chunk', text: delta })}\n\n`);
                                        }
                                    } catch (e) {
                                        // Ignore parsing errors for incomplete chunks
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (aiErr) {
                console.error('Fetch OpenRouter Error:', aiErr.message);
                aiResponseText = "Sorry, the AI service is currently experiencing issues. " + aiErr.message;
            }
        } else {
            aiResponseText = "OpenRouter API Key is missing in the environment variables.";
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: aiResponseText })}\n\n`);
        }

        // 5. Save AI Response
        const aiInsert = await pool.query(
            'INSERT INTO chat_messages (session_id, sender, content) VALUES ($1, $2, $3) RETURNING *',
            [sessionId, 'ai', aiResponseText]
        );

        res.write(`data: ${JSON.stringify({ type: 'done', message: aiInsert.rows[0] })}\n\n`);
        res.end();

        // After storing AI response, ensure the session has a meaningful title
        const sessionRes = await pool.query('SELECT title FROM chat_sessions WHERE id = $1', [sessionId]);
        const currentTitle = sessionRes.rows[0]?.title;
        if (!currentTitle || currentTitle.trim().toLowerCase() === 'new conversation') {
          try {
            if (OPENROUTER_API_KEY) {
              const titleRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: 'google/gemini-2.5-flash',
                  max_tokens: 50,
                  messages: [{ role: 'user', content: `Generate a very short title (max 4 words) summarizing this conversation so far.` }]
                })
              });
              const titleData = await titleRes.json();
              let newTitle = titleData.choices[0]?.message?.content?.trim() || 'New Conversation';
              newTitle = newTitle.replace(/^["']|["']$/g, '');
              await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [newTitle, sessionId]);
            }
          } catch (e) {
            console.error('Error auto-generating title:', e);
          }
        }

    } catch (error) {
        console.error('Error in sendMessage:', error);
        fs.appendFileSync('error_debug.log', new Date().toISOString() + ': ' + error.stack + '\n');
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to send message: ' + error.message });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', text: 'Internal Server Error' })}\n\n`);
            res.end();
        }
    }
};

export const deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        
        // Ensure user owns this session before deleting
        const check = await pool.query('SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found or not owned by user' });
        }
        
        // cascade delete should handle messages if configured in DB, but just in case:
        await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
        await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
        
        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
};
