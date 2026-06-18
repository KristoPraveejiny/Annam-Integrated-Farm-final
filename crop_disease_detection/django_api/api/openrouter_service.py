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
            }
    except Exception:
        pass
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

    return "\n".join(context)


def generate_chat_response(user_id, user_message, chat_history):
    system_prompt = (
        "You are an AI Smart Farming Assistant.\n"
        "Your purpose is to help farmers with crop cultivation, crop disease, fertilizer recommendation, "
        "irrigation decisions, weather-based farming advice, planting suggestions, harvesting time, "
        "livestock management, cattle care, and poultry management.\n"
        "Give simple practical farming advice. Consider the provided farm context. Avoid unnecessary technical explanations."
    )
    
    farm_context = get_farm_context(user_id)
    if farm_context:
        system_prompt += f"\n\nCURRENT FARM CONTEXT:\n{farm_context}"
    
    messages = [{"role": "system", "content": system_prompt}]
    
    for msg in chat_history:
        role = "assistant" if msg.sender == "AI" else "user"
        messages.append({"role": role, "content": msg.message})
        
    messages.append({"role": "user", "content": user_message})

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Annam Smart Farm AI"
    }
    
    # The user asked to use a general OpenRouter model
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
