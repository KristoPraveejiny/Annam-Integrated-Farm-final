// Weather-driven irrigation, harvest and planting guidance for crops.
//
// As with the livestock feed advice, every recommendation here is derived from
// the weather and the farm's own crop data - the AI layer only rewrites it in
// plain language. That keeps the advice available when the model is not.

const round = (value) => Math.round(value * 10) / 10;

function isWet(description) {
  const text = String(description || '').toLowerCase();
  return text.includes('rain') || text.includes('storm') || text.includes('drizzle') || text.includes('shower');
}

/**
 * Reference evapotranspiration, simplified. Enough to turn temperature,
 * humidity and wind into a "how much water did the field lose today" figure
 * without a full Penman-Monteith weather station feed.
 */
function estimateEvapotranspiration(weather) {
  const t = Number(weather?.temperature) || 0;
  const rh = Number(weather?.humidity) || 60;
  const wind = Number(weather?.windSpeed) || 0;
  const base = 0.0023 * (t + 17.8) * Math.max(1, t) ** 0.5;
  const dryness = Math.max(0.4, (100 - rh) / 50);
  const windFactor = 1 + Math.min(0.4, wind / 25);
  return Math.max(0, round(base * dryness * windFactor * 2.2));
}

function irrigationAdvice(weather, rainMm) {
  const et = estimateEvapotranspiration(weather);
  const rain = Number(rainMm) || 0;
  const deficit = round(Math.max(0, et - rain));
  const t = Number(weather?.temperature) || 0;

  let action;
  let detail;

  if (rain >= 10) {
    action = 'skip';
    detail = `About ${round(rain)} mm of rain is expected - skip irrigation and check that fields drain properly.`;
  } else if (rain >= 4) {
    action = 'reduce';
    detail = `Rain of about ${round(rain)} mm covers most of the crop's needs - irrigate lightly or not at all.`;
  } else if (deficit <= 2 && t < 30) {
    action = 'normal';
    detail = 'Keep the normal irrigation schedule; water loss is modest today.';
  } else if (t >= 34 || deficit >= 5) {
    action = 'increase';
    detail = `Hot, drying conditions - fields lose about ${et} mm. Irrigate early morning or after 4pm to cut evaporation.`;
  } else {
    action = 'normal';
    detail = `Fields lose about ${et} mm. Normal watering is enough, best done early morning.`;
  }

  return { action, detail, evapotranspiration_mm: et, rain_mm: round(rain), deficit_mm: deficit };
}

function harvestAdvice(weather, rainMm, dueCrops) {
  const rain = Number(rainMm) || 0;
  const names = dueCrops.map((crop) => crop.crop_name).join(', ');

  if (dueCrops.length === 0) {
    return {
      action: 'none',
      detail: 'No crop is due for harvest in the next few days.',
      crops: [],
    };
  }

  if (rain >= 10 || isWet(weather?.description)) {
    return {
      action: 'harvest_now',
      detail: `Rain is coming. Bring in ${names} before it arrives, and keep the produce under cover - wet harvest spoils and grades lower.`,
      crops: dueCrops,
    };
  }

  if (Number(weather?.humidity) >= 85) {
    return {
      action: 'delay_drying',
      detail: `${names} can be picked, but humidity is high, so drying will be slow. Spread the harvest thinly and use shade with airflow.`,
      crops: dueCrops,
    };
  }

  return {
    action: 'good',
    detail: `Good harvesting weather for ${names}. Pick in the cooler morning hours and move produce out of direct sun quickly.`,
    crops: dueCrops,
  };
}

function plantingAdvice(weather, rainMm) {
  const rain = Number(rainMm) || 0;
  const t = Number(weather?.temperature) || 0;

  if (rain >= 30) {
    return { action: 'wait', detail: `Heavy rain (about ${round(rain)} mm) will wash out seed and waterlog beds. Wait until the soil drains.` };
  }
  if (rain >= 5 && rain < 30 && t >= 18 && t <= 34) {
    return { action: 'good', detail: `Moist soil and mild temperatures make this a good planting window - sow after the rain eases.` };
  }
  if (t >= 35) {
    return { action: 'avoid', detail: 'Too hot for transplanting - seedlings will wilt. Wait for a cooler day or plant late in the evening.' };
  }
  if (rain < 1 && Number(weather?.humidity) < 45) {
    return { action: 'irrigate_first', detail: 'Soil is dry, so irrigate the bed before sowing and mulch to hold the moisture in.' };
  }
  return { action: 'fair', detail: 'Conditions are workable for planting. Water in well after sowing.' };
}

/**
 * Build the full advisory for one day.
 * `weather` is today's reading or tomorrow's forecast; `rainMm` is only
 * available for the forecast, so today falls back to its description.
 */
export function buildCropAdvice(weather, rainMm, dueCrops = []) {
  const rain = rainMm !== null && rainMm !== undefined
    ? rainMm
    : (isWet(weather?.description) ? 5 : 0);

  return {
    irrigation: irrigationAdvice(weather, rain),
    harvest: harvestAdvice(weather, rain, dueCrops),
    planting: plantingAdvice(weather, rain),
  };
}
