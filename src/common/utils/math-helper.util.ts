/**
 * Calculates the dynamic percentage growth between two numbers.
 * Handles edge cases like null, undefined, NaN, and zero divisions.
 */
export function calculateGrowth(
  current: number | null | undefined,
  previous: number | null | undefined,
  decimalPlaces: number = 2,
) {
  const cur = current && !isNaN(current) ? current : 0;
  const prev = previous && !isNaN(previous) ? previous : 0;

  let percentage = 0;

  if (prev > 0) {
    percentage = ((cur - prev) / prev) * 100;
  } else if (prev === 0 && cur > 0) {
    percentage = 100;
  } else if (prev === 0 && cur === 0) {
    percentage = 0;
  } else if (prev < 0) {
    // Handles negative base scenarios
    percentage = ((cur - prev) / Math.abs(prev)) * 100;
  }

  // Format decimal places and get the absolute value
  const formattedPercentage = parseFloat(percentage.toFixed(decimalPlaces));
  const absoluteValue = Math.abs(formattedPercentage);

  // Determine the directional prefix sign
  let prefix: '+' | '-' | '' = '';
  if (formattedPercentage > 0) {
    prefix = '+';
  } else if (formattedPercentage < 0) {
    prefix = '-';
  }

  return {
    value: `${absoluteValue}%`,
    prefix: prefix,
    formatted: `${prefix}${absoluteValue}%`,
    raw: formattedPercentage,
  };
}
