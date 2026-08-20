import axios from 'axios';

export async function getWeatherSummary(lat, lon) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.warn('OpenWeather API Key is not set.');
      return null;
    }

    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: lat,
        lon: lon,
        appid: apiKey,
        units: 'metric',
      },
    });

    const data = response.data;
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      windSpeed: data.wind.speed,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    return null;
  }
}

export async function getWeatherByCity(city) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.warn('OpenWeather API Key is not set.');
      return null;
    }

    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: city,
        appid: apiKey,
        units: 'metric',
      },
    });

    const data = response.data;
    return {
      temperature: data.main.temp,
      humidity: data.main.humidity,
      description: data.weather[0].description,
      windSpeed: data.wind.speed,
    };
  } catch (error) {
    console.error('Error fetching weather data by city:', error.message);
    return null;
  }
}

/**
 * Tomorrow's outlook, aggregated from the free 5-day / 3-hour forecast.
 * Returns null rather than throwing when the key or the API is unavailable,
 * so callers can fall back to today-only advice.
 */
export async function getTomorrowForecast(lat, lon) {
  return fetchTomorrow({ lat, lon });
}

/**
 * Forecast fallback for farms with no coordinates recorded, matching the
 * city fallback that getWeatherByCity provides for today's reading.
 */
export async function getTomorrowForecastByCity(city) {
  return fetchTomorrow({ q: city });
}

async function fetchTomorrow(locationParams) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.warn('OpenWeather API Key is not set.');
      return null;
    }

    const response = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
      params: { ...locationParams, appid: apiKey, units: 'metric' },
    });

    // Work in the location's own local time so "tomorrow" means the farm's
    // tomorrow, not the server's.
    const offsetSeconds = response.data.city?.timezone ?? 0;
    const localDay = (unixSeconds) =>
      new Date((unixSeconds + offsetSeconds) * 1000).toISOString().slice(0, 10);

    const todayKey = localDay(Math.floor(Date.now() / 1000));
    const slots = (response.data.list || []).filter((slot) => localDay(slot.dt) > todayKey);
    if (slots.length === 0) return null;

    const targetDay = localDay(slots[0].dt);
    const tomorrow = slots.filter((slot) => localDay(slot.dt) === targetDay);
    if (tomorrow.length === 0) return null;

    const temps = tomorrow.map((slot) => slot.main.temp);
    const humidities = tomorrow.map((slot) => slot.main.humidity);
    const winds = tomorrow.map((slot) => slot.wind?.speed ?? 0);
    const rain = tomorrow.reduce((sum, slot) => sum + (slot.rain?.['3h'] ?? 0), 0);

    // The description of the hottest slot represents the day better than the
    // first reading at midnight does.
    const peak = tomorrow.reduce((hottest, slot) => (slot.main.temp > hottest.main.temp ? slot : hottest), tomorrow[0]);

    const avg = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

    return {
      date: targetDay,
      temperature: Math.round(avg(temps) * 10) / 10,
      max_temperature: Math.round(Math.max(...temps) * 10) / 10,
      min_temperature: Math.round(Math.min(...temps) * 10) / 10,
      humidity: Math.round(avg(humidities)),
      windSpeed: Math.round(Math.max(...winds) * 10) / 10,
      rain_mm: Math.round(rain * 10) / 10,
      description: peak.weather?.[0]?.description || '',
      // Share of the day's readings that carry rain, as a rough chance figure.
      rain_chance: Math.round(tomorrow.filter((slot) => (slot.rain?.['3h'] ?? 0) > 0).length / tomorrow.length * 100),
    };
  } catch (error) {
    console.error('Error fetching forecast:', error.message);
    return null;
  }
}
