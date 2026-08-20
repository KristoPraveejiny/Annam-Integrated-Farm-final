// Weather-driven feed and water adjustments for livestock.
//
// The numbers here come from standard heat-stress models, not from the AI, so
// the manager always gets a concrete figure even when the AI key is missing or
// the model call fails. The AI layer on top only adds the plain-language
// explanation.

// Temperature-Humidity Index - the standard ruminant heat-stress measure.
export function calculateTHI(temperature, humidity) {
  const t = Number(temperature);
  const rh = Number(humidity);
  if (!Number.isFinite(t) || !Number.isFinite(rh)) return null;
  return (1.8 * t + 32) - ((0.55 - 0.0055 * rh) * (1.8 * t - 26));
}

// Ruminants (cattle, buffalo, goats) are graded on THI.
function ruminantStress(thi) {
  if (thi === null) return { level: 'unknown', water: 0, feed: 0 };
  if (thi < 68) return { level: 'none', water: 0, feed: 0 };
  if (thi < 72) return { level: 'mild', water: 10, feed: 0 };
  if (thi < 80) return { level: 'moderate', water: 20, feed: -5 };
  if (thi < 90) return { level: 'severe', water: 35, feed: -10 };
  return { level: 'emergency', water: 50, feed: -15 };
}

// Poultry respond to air temperature more directly than to THI.
function poultryStress(temperature) {
  const t = Number(temperature);
  if (!Number.isFinite(t)) return { level: 'unknown', water: 0, feed: 0 };
  if (t < 26) return { level: 'none', water: 0, feed: 0 };
  if (t < 30) return { level: 'mild', water: 15, feed: 0 };
  if (t < 33) return { level: 'moderate', water: 30, feed: -5 };
  if (t < 36) return { level: 'severe', water: 50, feed: -12 };
  return { level: 'emergency', water: 70, feed: -20 };
}

const RUMINANTS = ['cow', 'cattle', 'buffalo', 'goat', 'sheep', 'bull', 'calf'];
const POULTRY = ['hen', 'poultry', 'broiler', 'layer', 'chick', 'duck'];

export function classifyAnimal(animalType, breed = '') {
  const text = `${animalType || ''} ${breed || ''}`.toLowerCase();
  if (POULTRY.some((word) => text.includes(word))) return 'poultry';
  if (RUMINANTS.some((word) => text.includes(word))) return 'ruminant';
  return 'ruminant';
}

// Feed and water amounts are stored as free text ("40 kg/day", "Configurable"),
// so pull out a number when there is one and fall back to percentages when not.
export function parseAmount(value) {
  const match = String(value ?? '').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function unitOf(value, fallback) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('liter') || text.includes('litre') || text.includes('l/')) return 'litres/day';
  if (text.includes('kg')) return 'kg/day';
  return fallback;
}

const round = (value) => Math.round(value * 10) / 10;

/**
 * Work out the adjustment for one feed requirement row under the given weather.
 * Positive numbers mean "give this much more", negative "give this much less".
 */
export function buildAdviceForRequirement(requirement, weather) {
  const kind = classifyAnimal(requirement.animalType, requirement.breedOrVariety);
  const thi = calculateTHI(weather?.temperature, weather?.humidity);
  const stress = kind === 'poultry' ? poultryStress(weather?.temperature) : ruminantStress(thi);

  let waterPct = stress.water;
  let feedPct = stress.feed;
  const reasons = [];

  if (stress.level !== 'none' && stress.level !== 'unknown') {
    reasons.push(kind === 'poultry'
      ? `Air temperature ${round(weather.temperature)}°C puts birds under ${stress.level} heat stress.`
      : `THI ${Math.round(thi)} puts the herd under ${stress.level} heat stress.`);
  }

  // Very dry air drives extra evaporative loss on top of the heat itself.
  if (Number(weather?.humidity) < 40 && Number(weather?.temperature) > 28) {
    waterPct += 10;
    reasons.push('Dry air (humidity below 40%) increases water loss.');
  }

  // Cold or wet weather costs the animal energy it has to eat back.
  const cold = kind === 'poultry' ? 20 : 18;
  if (Number(weather?.temperature) < cold) {
    feedPct += kind === 'poultry' ? 10 : 8;
    reasons.push(`At ${round(weather.temperature)}°C animals burn extra energy keeping warm, so feed a little more.`);
  }

  const description = String(weather?.description || '').toLowerCase();
  if (description.includes('rain') || description.includes('storm') || description.includes('drizzle')) {
    feedPct += 5;
    reasons.push('Wet weather adds an energy cost, so keep feed slightly higher and dry.');
  }

  if (Number(weather?.windSpeed) > 8 && Number(weather?.temperature) < 22) {
    feedPct += 3;
    reasons.push('Strong wind with cool air increases heat loss.');
  }

  if (reasons.length === 0) {
    reasons.push('Conditions are comfortable - keep the normal feed and water schedule.');
  }

  const baseFeed = parseAmount(requirement.dailyFeedAmount);
  const baseWater = parseAmount(requirement.dailyWaterRequirement);

  return {
    id: requirement.id,
    animal_type: requirement.animalType,
    breed: requirement.breedOrVariety,
    kind,
    stress_level: stress.level,
    thi: thi === null ? null : Math.round(thi),
    water_change_percent: Math.round(waterPct),
    feed_change_percent: Math.round(feedPct),
    // Absolute figures only when the stored requirement carries a number.
    base_water: baseWater,
    base_feed: baseFeed,
    extra_water: baseWater === null ? null : round(baseWater * waterPct / 100),
    extra_feed: baseFeed === null ? null : round(baseFeed * feedPct / 100),
    water_unit: unitOf(requirement.dailyWaterRequirement, 'litres/day'),
    feed_unit: unitOf(requirement.dailyFeedAmount, 'kg/day'),
    reasons,
  };
}

export function buildAdvice(requirements, weather) {
  return requirements.map((requirement) => buildAdviceForRequirement(requirement, weather));
}
