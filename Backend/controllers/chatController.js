import { pool } from '../db.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWeatherSummary, getWeatherByCity } from '../services/weatherService.js';
import { getDefaultFarmId } from './livestockController.js';

// Helper to convert image to base64
const getBase64Image = (filePath) => {
    const bitmap = fs.readFileSync(filePath);
    return Buffer.from(bitmap).toString('base64');
};

// image_url is stored web-style ("/uploads/activities/x.jpg"); the files live
// next to server.js, so resolve against the Backend root rather than cwd -
// which depends on where node happened to be launched from.
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resolveUploadPath = (imageUrl) => path.join(BACKEND_ROOT, imageUrl.replace(/^\//, ''));

const MIME_BY_EXT = {
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg'
};
const mimeForFile = (filePath) =>
    MIME_BY_EXT[path.extname(filePath).slice(1).toLowerCase()] || 'image/jpeg';

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
        const { title, detectionId } = req.body;

        // A session opened from a disease detection belongs to that detection.
        // Returning the existing one keeps every follow-up question about the
        // same scan in a single conversation instead of spawning duplicates.
        if (detectionId) {
            const existing = await pool.query(
                'SELECT * FROM chat_sessions WHERE user_id = $1 AND detection_id = $2 LIMIT 1',
                [userId, detectionId]
            );
            if (existing.rowCount > 0) {
                return res.json({ ...existing.rows[0], reused: true });
            }
        }

        try {
            const result = await pool.query(
                'INSERT INTO chat_sessions (user_id, title, detection_id) VALUES ($1, $2, $3) RETURNING *',
                [userId, title || 'New Conversation', detectionId || null]
            );
            res.json({ ...result.rows[0], reused: false });
        } catch (insertError) {
            // Double-click: another request won the race against the unique
            // index. Hand back the session it created rather than failing.
            if (insertError.code === '23505' && detectionId) {
                const winner = await pool.query(
                    'SELECT * FROM chat_sessions WHERE user_id = $1 AND detection_id = $2 LIMIT 1',
                    [userId, detectionId]
                );
                if (winner.rowCount > 0) {
                    return res.json({ ...winner.rows[0], reused: true });
                }
            }
            throw insertError;
        }
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
A separate CNN module handles automated disease scanning. Do not claim to be that module or to replace its scan.
When the user shares a photo, DO look at it carefully and describe what you actually see - the colour, shape, edges and spread of the marks, and which part of the plant is affected.
The CNN prediction is a starting point, not the truth. It is often wrong on unusual images or when its confidence is low, so never simply repeat it. Weigh it against what the photo actually shows and against the current weather and season.
If the photo disagrees with the CNN prediction, say so plainly and explain which signs led you there.
Always state how sure you are, and if the photo is blurry, too dark, or too far away to judge, say that and tell the user exactly what better photo to take.
Always base your advice on the current weather if available. Format your responses using Markdown. Keep advice practical and actionable.

CRITICAL INSTRUCTION:
Keep the whole answer under about 300 words. A short, complete answer is far better than a long one that gets cut off.
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
            const confidence = Number(confidenceContext);
            systemPrompt += `\n\nCONTEXT FROM DISEASE DETECTION MODULE:
The user scanned a ${cropContext} leaf and the CNN model predicted '${diseaseContext}' with ${confidenceContext}% confidence.`;

            // Below ~60% the CNN is effectively guessing, so leaning on its label
            // would hand the farmer a confident answer built on a coin flip.
            if (Number.isFinite(confidence) && confidence < 60) {
                systemPrompt += `
This confidence is LOW - treat the label as unreliable. Judge the photo on its own merits first, then say whether it supports or contradicts the CNN's guess. It is fine to conclude the problem is something else entirely, or that the image cannot be judged.`;
            } else {
                systemPrompt += `
Confidence is reasonable, but still check it against the photo before building advice on it, and mention any sign that does not fit.`;
            }
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
                        let newTitle = titleData?.choices?.[0]?.message?.content?.trim() || 'New Conversation';
                        // Clean up quotes
                        newTitle = newTitle.replace(/^["']|["']$/g, '');
                        await pool.query('UPDATE chat_sessions SET title = $1 WHERE id = $2', [newTitle, sessionId]);
                    }
                } catch (e) {
                    console.error('Error generating title:', e);
                }
            }, 100);
        }

        // Past images have to be re-attached, not summarised as "Uploaded an
        // image." - otherwise the model goes blind on every follow-up question
        // and answers about a leaf it can no longer see. Only the most recent
        // few are resent, since each image is expensive in tokens.
        const MAX_HISTORY_IMAGES = 2;
        const historyImageIds = history
            // The current message is popped and re-added below with its own image.
            .filter((msg) => msg.sender === 'user' && msg.image_url && msg.id !== userInsert.rows[0].id)
            .slice(-MAX_HISTORY_IMAGES)
            .map((msg) => msg.id);

        for (const msg of history) {
            if (msg.sender === 'user') {
                const attachImage = msg.image_url && historyImageIds.includes(msg.id);
                let dataUrl = null;
                if (attachImage) {
                    try {
                        const diskPath = resolveUploadPath(msg.image_url);
                        if (fs.existsSync(diskPath)) {
                            dataUrl = `data:${mimeForFile(diskPath)};base64,${getBase64Image(diskPath)}`;
                        }
                    } catch (imgErr) {
                        console.error('Could not re-attach chat image:', imgErr.message);
                    }
                }

                if (dataUrl) {
                    const parts = [];
                    if (msg.content) parts.push({ type: 'text', text: msg.content });
                    parts.push({ type: 'image_url', image_url: { url: dataUrl } });
                    messages.push({ role: 'user', content: parts });
                } else {
                    messages.push({ role: 'user', content: msg.content || "Uploaded an image." });
                }
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
        let finishReason = null;

        if (OPENROUTER_API_KEY) {
            try {
                const askOpenRouter = (maxTokens) => fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        max_tokens: maxTokens,
                        messages: messages,
                        stream: true
                    })
                });

                let fetchRes = await askOpenRouter(1000);

                // A low OpenRouter balance rejects the request outright (402) and
                // names the number of tokens it CAN afford. Retry once inside that
                // budget so the farmer still gets an answer, just a shorter one.
                if (fetchRes.status === 402) {
                    const errText = await fetchRes.text();
                    const affordable = Number(errText.match(/can only afford (\d+)/)?.[1]);
                    if (affordable > 50) {
                        console.warn(`OpenRouter low balance, retrying with ${affordable - 20} tokens.`);
                        fetchRes = await askOpenRouter(affordable - 20);
                    } else {
                        console.error('OpenRouter Error:', errText);
                        aiResponseText = "The AI service is out of credits, so I cannot answer right now. Please top up the OpenRouter account to continue.";
                    }
                }

                if (aiResponseText) {
                    res.write(`data: ${JSON.stringify({ type: 'chunk', text: aiResponseText })}\n\n`);
                } else if (!fetchRes.ok) {
                    const errText = await fetchRes.text();
                    console.error('OpenRouter Error:', errText);
                    const reason = (() => {
                        try { return JSON.parse(errText).error?.message; } catch { return null; }
                    })();
                    aiResponseText = `Sorry, the AI service experienced an error.${reason ? ` (${reason})` : ''}`;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', text: aiResponseText })}\n\n`);
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
                                        if (parsed.choices?.[0]?.finish_reason) {
                                            finishReason = parsed.choices[0].finish_reason;
                                        }
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

        // The suggested questions are the last thing the model writes, so they are
        // the first casualty when the reply is cut off at the token limit - the
        // user is left staring at a dangling "SUGGESTED_". Drop the broken
        // fragment and supply a usable set instead.
        const hasSuggestions = /SUGGESTED_QUESTIONS:\s*\[[^\]]*\]/s.test(aiResponseText);
        if (aiResponseText && !hasSuggestions) {
            if (finishReason === 'length') {
                console.warn('Chat reply hit the token limit; suggestions were truncated.');
            }
            // Remove any partial "SUGGESTED_QUESTIONS: [\"half a que" tail.
            aiResponseText = aiResponseText.replace(/\n*SUGGESTED_?Q?U?E?S?T?I?O?N?S?:?[\s\S]*$/i, '').trim();

            if (!/Sorry, the AI service|out of credits|API Key is missing/i.test(aiResponseText)) {
                const fallbackQuestions = [
                    'Can you explain that in simpler steps?',
                    'What should I do first this week?',
                    'How do I stop this from happening again?'
                ];
                const suffix = `\n\nSUGGESTED_QUESTIONS: ${JSON.stringify(fallbackQuestions)}`;
                aiResponseText += suffix;
                res.write(`data: ${JSON.stringify({ type: 'chunk', text: suffix })}\n\n`);
            }
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
              let newTitle = titleData?.choices?.[0]?.message?.content?.trim() || 'New Conversation';
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
