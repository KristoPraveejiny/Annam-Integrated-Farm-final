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
