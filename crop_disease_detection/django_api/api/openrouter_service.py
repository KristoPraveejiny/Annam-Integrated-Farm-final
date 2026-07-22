import os
import requests
import json
from django.db import connection
from datetime import datetime

OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', '')
DEFAULT_CITY = os.getenv('DEFAULT_CITY', 'Neeliyamodai, Vavuniya, Sri Lanka')

def get_live_weather():
    try:
        url = 'https://api.openweathermap.org/data/2.5/weather'
        resp = requests.get(url, params={'q': DEFAULT_CITY, 'units': 'metric', 'appid': OPENWEATHER_API_KEY}, timeout=5)
        if resp.status_code == 200:
            w = resp.json()
            return {
                'temperature': w['main']['temp'],
                'humidity': w['main']['humidity'],
                'condition': w['weather'][0]['main'],
                'description': w['weather'][0]['description'],
                'wind_speed': w['wind']['speed'],
                'pressure': w['main'].get('pressure', None),
                'clouds': w.get('clouds', {}).get('all', None),
                'rain': w.get('rain', {}).get('1h', 0.0) or w.get('rain', {}).get('3h', 0.0) or 0.0
            }
    except Exception:
        pass
    return None

def get_weather_forecast():
    try:
        url = 'https://api.openweathermap.org/data/2.5/forecast'
        resp = requests.get(url, params={'q': DEFAULT_CITY, 'units': 'metric', 'appid': OPENWEATHER_API_KEY}, timeout=5)
        if resp.status_code == 200:
            forecast_data = resp.json()
            forecast_list = forecast_data.get('list', [])
            # Get 5 representative daily forecast items (every 8th slot)
            daily_forecasts = []
            for i in range(0, len(forecast_list), 8):
                if len(daily_forecasts) < 5:
                    item = forecast_list[i]
                    daily_forecasts.append({
                        'time': item.get('dt_txt'),
                        'temp': f"{item['main']['temp']} °C" if 'main' in item and 'temp' in item['main'] else 'N/A',
                        'humidity': f"{item['main']['humidity']} %" if 'main' in item and 'humidity' in item['main'] else 'N/A',
                        'rain_prob': f"{round(float(item.get('pop', 0.0)) * 100)} %",
                        'condition': item['weather'][0]['description'] if 'weather' in item and len(item['weather']) > 0 else 'Unknown'
                    })
            return daily_forecasts
    except Exception:
        pass
    return []

def get_latest_disease_detection(user_id):
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT crop_name, disease_name, confidence 
                FROM disease_detection_history 
                WHERE user_id = %s
                ORDER BY created_at DESC 
                LIMIT 1
            """, [user_id])
            row = cursor.fetchone()
            if row:
                return {
                    'crop': row[0],
                    'disease': row[1],
                    'confidence': row[2]
                }
    except Exception as e:
        print("Error fetching latest disease detection:", e)
    return None

def get_farm_context(user_id):
    context = []
    
    # Weather
    weather = get_live_weather()
    if weather:
        context.append(f"Weather in {DEFAULT_CITY}: {weather['temperature']}°C, Humidity {weather['humidity']}%, Condition: {weather['condition']} ({weather['description']}), Wind: {weather['wind_speed']}m/s.")

    # Fetch active crops
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT cc.crop_name, cc.current_stage 
            FROM crop_cycles cc
            JOIN farms f ON cc.farm_id = f.id
            LEFT JOIN farm_memberships fm ON f.id = fm.farm_id
            WHERE (f.owner_user_id = %s OR fm.user_id = %s) AND cc.status IN ('planned', 'seeded', 'growing', 'harvesting')
            LIMIT 5
        """, [user_id, user_id])
        crops = cursor.fetchall()
        if crops:
            crops_str = ", ".join([f"{c[0]} (Stage: {c[1]})" for c in crops])
            context.append(f"Active Crops: {crops_str}.")
            
        cursor.execute("""
            SELECT lg.species, lg.count_current, lg.status
            FROM livestock_groups lg
            JOIN farms f ON lg.farm_id = f.id
            LEFT JOIN farm_memberships fm ON f.id = fm.farm_id
            WHERE (f.owner_user_id = %s OR fm.user_id = %s) AND lg.count_current > 0
            LIMIT 5
        """, [user_id, user_id])
        livestock = cursor.fetchall()
        if livestock:
            livestock_str = ", ".join([f"{l[1]}x {l[0]} ({l[2]})" for l in livestock])
            context.append(f"Livestock: {livestock_str}.")
            
        cursor.execute("""
            SELECT t.title, t.status
            FROM tasks t
            JOIN farms f ON t.farm_id = f.id
            LEFT JOIN farm_memberships fm ON f.id = fm.farm_id
            WHERE (f.owner_user_id = %s OR fm.user_id = %s) AND t.status IN ('todo', 'in_progress')
            LIMIT 5
        """, [user_id, user_id])
        tasks = cursor.fetchall()
        if tasks:
            tasks_str = ", ".join([f"{t[0]} ({t[1]})" for t in tasks])
            context.append(f"Pending/Active Tasks: {tasks_str}.")

        cursor.execute("""
            SELECT ff.field_name, ff.soil_type, ff.soil_ph
            FROM farm_fields ff
            JOIN farms f ON ff.farm_id = f.id
            LEFT JOIN farm_memberships fm ON f.id = fm.farm_id
            WHERE (f.owner_user_id = %s OR fm.user_id = %s)
            LIMIT 5
        """, [user_id, user_id])
        fields = cursor.fetchall()
        if fields:
            fields_str = ", ".join([f"{f[0]} (Soil: {f[1] or 'Unknown'}, pH: {f[2] if f[2] is not None else 'Unknown'})" for f in fields])
            context.append(f"Fields: {fields_str}.")

    return "\n".join(context)


def generate_chat_response(user_id, user_message, chat_history):
    system_prompt = """You are AgriMind AI, an intelligent AI farming assistant integrated into a Smart Farm Management System.

Your role is to help farmers and farm managers by answering farming questions using four sources of information:
1. User's question.
2. Current Weather from OpenWeather API.
3. 5-Day Weather Forecast from OpenWeather API.
4. Latest AI Crop Disease Detection result (if available).

You are NOT a general chatbot.
Always answer only agriculture, crop, livestock, irrigation, soil, fertilizer, pest, disease, harvesting, marketplace, and farm management related questions.
If the user asks an unrelated question, politely inform them that you are AgriMind AI and can only assist with agricultural and farming queries.

-----------------------------------
YOUR RESPONSE FORMAT
-----------------------------------

1. Direct Answer
Give a simple and professional answer.

2. Weather Analysis
Explain how today's weather affects the crop.

3. Forecast Analysis
Explain what may happen during the next five days.

4. Disease Risk
If weather increases disease risk, explain why.
If AI disease detection exists, relate your advice to the detected disease.
Example:
Detected Disease:
Early Blight
Current humidity is high.
This weather increases fungal infection.

5. Recommended Actions
Provide step-by-step actions.
Include:
• Irrigation advice
• Fertilizer advice
• Spray recommendation
• Harvest recommendation
• Worker recommendation

6. Warning
Warn if:
Heavy rain
Heat stress
High humidity
Strong wind
Disease spread
Water logging
Drought

7. Confidence
If disease confidence is below 60% say:
"The AI prediction confidence is low. Please upload another clear leaf image."

Never invent diseases.
Never say confidence above 100%.
Never answer outside agriculture.
Use simple English.
Limit answer to around 300 words.
"""

    # Fetch dynamic inputs
    weather = get_live_weather()
    forecast = get_weather_forecast()
    disease_detection = get_latest_disease_detection(user_id)
    farm_context_str = get_farm_context(user_id)

    # Format Weather block
    if weather:
        temp_val = f"{weather['temperature']} °C"
        humidity_val = f"{weather['humidity']} %"
        rain_val = f"{weather['rain']} mm"
        wind_speed_val = f"{weather['wind_speed']} m/s"
        pressure_val = f"{weather['pressure']} hPa" if weather['pressure'] is not None else "N/A"
        clouds_val = f"{weather['clouds']} %" if weather['clouds'] is not None else "N/A"
    else:
        temp_val = humidity_val = rain_val = wind_speed_val = pressure_val = clouds_val = "N/A"

    forecast_json = json.dumps(forecast, indent=2) if forecast else "[]"

    # Build formatted user-facing message block
    formatted_user_message = f"""-----------------------------------
CURRENT WEATHER
-----------------------------------
Temperature: {temp_val}
Humidity: {humidity_val}
Rain: {rain_val}
Wind Speed: {wind_speed_val}
Pressure: {pressure_val}
Clouds: {clouds_val}

-----------------------------------
5 DAY WEATHER FORECAST
-----------------------------------
{forecast_json}
"""

    if disease_detection:
        formatted_user_message += f"""
-----------------------------------
LATEST DISEASE DETECTION
-----------------------------------
Crop: {disease_detection['crop']}
Disease: {disease_detection['disease']}
Confidence: {disease_detection['confidence']}%
"""

    if farm_context_str:
        formatted_user_message += f"""
-----------------------------------
FARM CONTEXT
-----------------------------------
{farm_context_str}
"""

    formatted_user_message += f"""
-----------------------------------
USER QUESTION
-----------------------------------
{user_message}
"""

    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in chat_history:
        role = "assistant" if msg.sender == "AI" else "user"
        messages.append({"role": role, "content": msg.message})
        
    messages.append({"role": "user", "content": formatted_user_message})

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Annam Smart Farm AI"
    }
    
    data = {
        "model": "meta-llama/llama-3.1-8b-instruct",
        "messages": messages
    }
    
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=15
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        import traceback
        traceback.print_exc()
        if hasattr(e, 'response') and e.response:
            print("Response:", e.response.text)
        return f"Sorry, I am currently unable to reach the AI servers. Error: {str(e)}"
