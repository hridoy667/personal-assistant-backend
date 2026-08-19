// health-science.util.ts

export interface HealthProfile {
  weightKg: number;
  heightMeters: number;
  ageYears: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  activityLevel: 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE';
}

export interface WeatherContext {
  tempFeelsLike: number;
  humidity: number;
  pressure: number; // Barometric pressure in hPa
  uvIndex: number | null;
  aqi: number | null; // 1 (Good) to 5 (Very Poor)
  pm25: number | null;
  isDaylight: boolean;
  sunrise: number; // Unix timestamp
  sunset: number; // Unix timestamp
}

export interface AdvisoriesResult {
  isOutdoorExerciseRecommended: boolean;
  warnings: string[];
  insights: {
    category: string;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
  }[];
}

/**
 * Dynamic Hydration Calculator (EFSA + ACSM + Environmental Compensation)
 */
export function calculateDynamicHydration(
  profile: HealthProfile,
  weather: WeatherContext,
): { recommendedMl: number; breakdown: string } {
  // 1. Base requirement: 35ml per kg body weight (EFSA Standard)
  const baseMl = Math.round(profile.weightKg * 35);

  // 2. Activity level addition (ACSM Guidelines)
  const activityMap: Record<HealthProfile['activityLevel'], number> = {
    SEDENTARY: 0,
    LIGHTLY_ACTIVE: 350,
    MODERATELY_ACTIVE: 700,
    VERY_ACTIVE: 1050,
  };
  const activityMl = activityMap[profile.activityLevel] || 0;

  // 3. Heat & Humidity Compensation
  let heatExtraMl = 0;
  if (weather.tempFeelsLike > 28) {
    const excessTemp = weather.tempFeelsLike - 28;
    // 500ml per 5°C above 28°C threshold
    heatExtraMl = Math.round((excessTemp / 5) * 500);

    // High humidity (>70%) prevents evaporative cooling, requiring additional hydration
    if (weather.humidity > 70) {
      heatExtraMl += 250;
    }
  }

  const totalMl = baseMl + activityMl + heatExtraMl;

  return {
    recommendedMl: totalMl,
    breakdown: `Base (${baseMl}ml) + Activity (${activityMl}ml) + Environmental Adjustment (${heatExtraMl}ml)`,
  };
}

/**
 * Basal Metabolic Rate (BMR - Mifflin-St Jeor Equation)
 */
export function calculateBMR(profile: HealthProfile): number {
  const heightCm = profile.heightMeters * 100;
  let bmr = 10 * profile.weightKg + 6.25 * heightCm - 5 * profile.ageYears;

  if (profile.gender === 'FEMALE') {
    bmr -= 161;
  } else {
    bmr += 5; // Default to male baseline if 'MALE' or 'OTHER'
  }

  return Math.round(bmr);
}

/**
 * Total Daily Energy Expenditure (TDEE) with Cold Thermal Adjustment
 */
export function calculateTDEE(profile: HealthProfile, weather: WeatherContext): number {
  const bmr = calculateBMR(profile);

  const activityMultipliers: Record<HealthProfile['activityLevel'], number> = {
    SEDENTARY: 1.2,
    LIGHTLY_ACTIVE: 1.375,
    MODERATELY_ACTIVE: 1.55,
    VERY_ACTIVE: 1.725,
  };

  let tdee = bmr * (activityMultipliers[profile.activityLevel] || 1.2);

  // Cold Weather Adjustment: Shivering & thermogenesis increase caloric expenditure (~5%)
  if (weather.tempFeelsLike < 10) {
    tdee *= 1.05;
  }

  return Math.round(tdee);
}

/**
 * Comprehensive Environmental Health & Safety Advisories (WHO / EPA / Neurological)
 */
export function getOutdoorAdvisory(weather: WeatherContext): AdvisoriesResult {
  const warnings: string[] = [];
  const insights: AdvisoriesResult['insights'] = [];
  let isOutdoorExerciseRecommended = true;

  // 1. Air Quality & Respiratory Checks (US EPA / WHO Standards)
  if (weather.aqi && weather.aqi >= 4) {
    isOutdoorExerciseRecommended = false;
    warnings.push('High air pollution detected (AQI Poor+). Move cardio workouts indoors.');
    insights.push({
      category: 'Air Quality',
      level: 'HIGH',
      message: 'Poor air quality detected. Limit prolonged outdoor exertion to protect respiratory health.',
    });
  } else if (weather.pm25 && weather.pm25 > 35.4) {
    warnings.push('Elevated PM2.5 levels. Sensitive individuals should reduce outdoor exertion.');
  }

  // 2. Extreme Heat & Thermoregulation Safety
  if (weather.tempFeelsLike > 35) {
    isOutdoorExerciseRecommended = false;
    warnings.push('Extreme heat conditions (Feels like > 35°C). Avoid strenuous midday exercise.');
    insights.push({
      category: 'Thermal Stress',
      level: 'HIGH',
      message: 'High heat stress conditions. Schedule workouts for cooler early morning hours.',
    });
  }

  // 3. Barometric Pressure & Headache/Migraine Sensitivity
  if (weather.pressure && weather.pressure < 1008) {
    insights.push({
      category: 'Barometric Risk',
      level: 'MEDIUM',
      message: 'Low pressure detected (<1008 hPa). Elevated risk of pressure headaches and fatigue; stay hydrated.',
    });
  }

  // 4. UV Protection & Circadian Alignment Protocols
  if (weather.uvIndex !== null) {
    if (weather.uvIndex >= 8) {
      warnings.push('Very High UV Index (8+). Apply broad-spectrum SPF 30+ sunscreen and wear sunglasses.');
      insights.push({
        category: 'UV Radiation',
        level: 'HIGH',
        message: 'Very high UV levels. Seek shade between 10:00 AM and 4:00 PM.',
      });
    } else if (weather.uvIndex >= 3 && weather.isDaylight) {
      insights.push({
        category: 'Circadian Light',
        level: 'LOW',
        message: 'Optimal daylight conditions. 10–15 minutes of sun exposure benefits natural Vitamin D and sleep-wake cycles.',
      });
    }
  }

  return {
    isOutdoorExerciseRecommended,
    warnings,
    insights,
  };
}