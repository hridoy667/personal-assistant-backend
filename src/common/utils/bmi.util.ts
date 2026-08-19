/**
 * Calculate BMI Score and Category of any user.
 * @param height in meters
 * @param weight in kg
 */
export async function bmiScore(
  height: number | null | undefined, 
  weight: number | null | undefined
): Promise<{ score: number; category: string }> {
  if (!height || height <= 0 || !weight || weight <= 0) {
    return { score: 0, category: 'Unknown' };
  }

  const bmi = weight / (height * height);
  const score = Number(bmi.toFixed(1));

  let category = 'Unknown';

  if (score < 18.5) {
    category = 'Underweight';
  } else if (score <= 24.9) {
    category = 'Normal weight';
  } else if (score <= 29.9) {
    category = 'Overweight';
  } else {
    category = 'Obesity';
  }

  return { score, category };
}