import axios from 'axios';

// A low OpenRouter balance rejects the request outright (402) but names the
// token budget it CAN afford, so retry once inside that budget instead of
// losing the answer entirely.
async function askOpenRouter(apiKey, prompt, maxTokens) {
  const post = (tokens) => axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'google/gemini-2.5-flash',
      max_tokens: tokens,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  try {
    return await post(maxTokens);
  } catch (err) {
    const affordable = err.response?.status === 402
      ? Number(JSON.stringify(err.response.data).match(/can only afford (\d+)/)?.[1])
      : NaN;
    if (!(affordable > 50)) throw err;
    console.warn(`OpenRouter low balance, retrying with ${affordable - 20} tokens.`);
    return await post(affordable - 20);
  }
}

// The advice call is best-effort: a missing API key, no OpenRouter credit, or a
// malformed reply must never break a detection that already succeeded. Instead
// of returning null (which callers then dereference), fall back to generic but
// genuinely usable guidance and flag it so the UI can say the advice is not
// AI-generated.
function buildFallbackRecommendation(cropName, diseaseName, weatherSummary, confidence) {
  const weatherNote = weatherSummary
    ? `Current conditions: ${weatherSummary.temperature}°C, ${weatherSummary.humidity}% humidity, ${weatherSummary.description || 'n/a'}.`
    : 'Weather data is not available right now.';

  return {
    is_fallback: true,
    disease_explanation: `The image of your ${cropName} looks like ${diseaseName} (${confidence}% match). Detailed AI advice could not be generated right now, so here are the standard steps for this kind of leaf problem.`,
    possible_causes: [
      'Long wet leaves - rain, dew, or watering from the top.',
      'High humidity and poor air flow between plants.',
      'Infected leaves or plant waste left in the field from the last crop.'
    ],
    organic_treatment: [
      'Pick off and burn or bury the badly affected leaves. Do not leave them in the field.',
      'Spray neem oil mixed with water, early morning or late evening, every 7 days.',
      'Water at the base of the plant only, so the leaves stay dry.'
    ],
    chemical_treatment: [
      'Use a copper-based fungicide from your local agri shop.',
      'Follow the dose written on the packet - do not use more than it says.',
      'Spray again after 10-14 days if new spots keep appearing.'
    ],
    immediate_action: [
      'Remove the worst affected leaves today.',
      'Stop watering over the top of the plants.',
      'Check the plants next to it for the same spots.'
    ],
    future_prevention: [
      'Leave more space between plants so air can move.',
      'Rotate to a different crop family next season.',
      'Clear all old plant waste before planting again.'
    ],
    weather_based_advice: `${weatherNote} If it is humid or raining, spray only when the weather is dry, and check your plants more often.`
  };
}

export async function generateDiseaseRecommendations(cropName, diseaseName, weatherSummary, confidence, languageCode = 'en') {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('OpenRouter API Key is not set.');
      return buildFallbackRecommendation(cropName, diseaseName, weatherSummary, confidence);
    }

    const weatherJSON = weatherSummary ? JSON.stringify(weatherSummary) : "Not available";
    
    // Map common language codes to full names for the AI prompt
    const languageNames = {
      'en': 'English',
      'ta': 'Tamil',
      'si': 'Sinhalese'
    };
    const targetLanguage = languageNames[languageCode] || 'English';

    const prompt = `You are a helpful agricultural AI assistant for the Smart Farm Management System. You are talking directly to a local farmer.

A crop disease has been detected using an AI vision model.

Details:
- Crop: ${cropName}
- Disease: ${diseaseName}
- Confidence: ${confidence}%
- Farm Location Weather: ${weatherJSON}

Task:
1. Explain the disease in VERY simple terms. (No scientific jargon, just explain what it looks like and what it does to the plant)
2. Identify possible causes based on weather (Use simple language)
3. Give organic treatment (Practical, easy-to-understand steps)
4. Give chemical treatment (Clear instructions without complex chemical details)
5. Provide prevention steps (Simple farming practices)
6. Give immediate action for farmer (What should they do right now?)
7. Adjust advice based on weather conditions (Simple and direct)

CRITICAL INSTRUCTION: Your entire response must be written in VERY simple, basic language. The farmer might not have a high level of formal education. Avoid big words, scientific names, or professional jargon. Keep sentences short and practical. Translate complex concepts into everyday farming language.

**TRANSLATION REQUIREMENT**: You MUST write your entire JSON response (the values, not the keys) in ${targetLanguage}.

Please provide your advice structured EXACTLY as the following JSON. Do not include markdown formatting like \`\`\`json, just return the raw JSON object:

{
  "disease_explanation": "Answer to Task 1",
  "possible_causes": ["Answer to Task 2"],
  "organic_treatment": ["Answer to Task 3"],
  "chemical_treatment": ["Answer to Task 4"],
  "immediate_action": ["Answer to Task 6"],
  "future_prevention": ["Answer to Task 5"],
  "weather_based_advice": "Answer to Task 7"
}
`;

    const response = await askOpenRouter(apiKey, prompt, 1000);

    const content = response.data.choices[0].message.content;
    
    // Clean up potential markdown formatting if the model still outputs it
    const jsonStr = content.replace(/^```json/m, '').replace(/```$/m, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Error generating AI recommendations:', error.response?.data || error.message);
    return buildFallbackRecommendation(cropName, diseaseName, weatherSummary, confidence);
  }
}

/**
 * Turn the calculated feed/water adjustments into plain advice a farm manager
 * can act on. The calculations are done before this call - the model only
 * explains them - so a missing key or a failed call degrades to numbers
 * without narrative rather than to nothing at all.
 */
export async function generateFeedWeatherAdvice(weatherSummary, adviceRows, languageCode = 'en', tomorrow = null) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('OpenRouter API Key is not set.');
      return null;
    }

    const languageNames = { en: 'English', ta: 'Tamil', si: 'Sinhalese' };
    const targetLanguage = languageNames[languageCode] || 'English';

    const prompt = `You are an livestock advisor for a Sri Lankan farm. Today's weather and the calculated feeding adjustments are given below.

Weather: ${JSON.stringify(weatherSummary)}

Calculated adjustments per animal group (already worked out from heat-stress models - do NOT change these numbers, only explain them):
${JSON.stringify(adviceRows.map((row) => ({
      animal: `${row.animal_type} ${row.breed}`,
      stress_level: row.stress_level,
      water_change_percent: row.water_change_percent,
      feed_change_percent: row.feed_change_percent,
      extra_water: row.extra_water,
      water_unit: row.water_unit,
      extra_feed: row.extra_feed,
      feed_unit: row.feed_unit,
    })))}

${tomorrow ? `Tomorrow's forecast and its calculated adjustments:
${JSON.stringify(tomorrow)}` : ''}

Task: write short, practical guidance for the farm manager. Use very simple language and short sentences. Say clearly how much extra water and extra (or reduced) feed to give, and at what time of day. Mention shade, ventilation or cooling only if the weather calls for it.

Write your entire response in ${targetLanguage}. Return raw JSON only, no markdown fences:

{
  "headline": "One short sentence summarising today's conditions for the animals",
  "groups": [
    { "animal": "exact animal name from the input", "advice": "2-3 short sentences of practical instruction" }
  ],
  "general_tips": ["3 to 5 short practical tips for today"],
  "tomorrow": "One or two sentences on what to prepare for tomorrow - water to store, feed to order, shade to set up. Omit this field if no forecast was given."
}
`;

    const response = await askOpenRouter(apiKey, prompt, 900);

    const content = response.data.choices[0].message.content;
    const jsonStr = content.replace(/^```json/m, '').replace(/```$/m, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error generating feed weather advice:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Plain-language wrapper around the calculated crop advisory. Same contract as
 * the feed advice: the rules decide, the model only explains.
 */
export async function generateCropWeatherAdvice(payload, languageCode = 'en') {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('OpenRouter API Key is not set.');
      return null;
    }

    const languageNames = { en: 'English', ta: 'Tamil', si: 'Sinhalese' };
    const targetLanguage = languageNames[languageCode] || 'English';

    const prompt = `You are an agronomy advisor for a Sri Lankan farm. Below are today's weather, tomorrow's forecast, the crops due for harvest, and the irrigation/harvest/planting decisions already calculated from agronomic rules.

${JSON.stringify(payload)}

Do NOT change any number or reverse any decision - explain them. Write short, practical sentences a farm manager can act on straight away. Mention timing of day where it matters.

Write your entire response in ${targetLanguage}. Return raw JSON only, no markdown fences:

{
  "headline": "One short sentence on what today and tomorrow mean for the fields",
  "today": { "irrigation": "1-2 sentences", "harvest": "1-2 sentences", "planting": "1-2 sentences" },
  "tomorrow": { "irrigation": "1-2 sentences", "harvest": "1-2 sentences", "planting": "1-2 sentences" },
  "priority_actions": ["3 to 5 short actions, most urgent first"]
}
`;

    const response = await askOpenRouter(apiKey, prompt, 1000);

    const content = response.data.choices[0].message.content;
    const jsonStr = content.replace(/^```json/m, '').replace(/```$/m, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error generating crop weather advice:', error.response?.data || error.message);
    return null;
  }
}
