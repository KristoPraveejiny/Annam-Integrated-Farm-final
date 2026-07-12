import axios from 'axios';

export async function generateDiseaseRecommendations(cropName, diseaseName, weatherSummary, confidence, languageCode = 'en') {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('OpenRouter API Key is not set.');
      return null;
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

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.5-flash',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0].message.content;
    
    // Clean up potential markdown formatting if the model still outputs it
    const jsonStr = content.replace(/^```json/m, '').replace(/```$/m, '').trim();
    return JSON.parse(jsonStr);

  } catch (error) {
    console.error('Error generating AI recommendations:', error.response?.data || error.message);
    return null;
  }
}
