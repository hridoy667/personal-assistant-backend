/**
 * Converts height strings like "5'3"", "5 feet 3 inches", or "5.3" into meters.
 * Returns null if string is empty or invalid.
 */
export function parseHeightToMeters(heightInput: string | number | null | undefined): number | null {
  if (!heightInput) return null;

  // If already a number or numeric string, return as float
  if (typeof heightInput === 'number') return heightInput;
  
  const trimmed = heightInput.trim();
  
  // Matches formats: 5'3", 5' 3", 5'3, 5ft 3in, 5 ft 3 in
  const feetInchesRegex = /^(\d+)\s*(?:'|ft|feet)?\s*(\d+)?\s*(?:"|in|inches)?$/i;
  const match = trimmed.match(feetInchesRegex);

  if (match) {
    const feet = parseInt(match[1], 10) || 0;
    const inches = parseInt(match[2], 10) || 0;
    
    // Total inches * 0.0254 = meters
    const totalInches = (feet * 12) + inches;
    return parseFloat((totalInches * 0.0254).toFixed(2));
  }

  // Fallback: parse direct decimal number string (e.g., "1.60")
  const parsedFloat = parseFloat(trimmed);
  return isNaN(parsedFloat) ? null : parsedFloat;
}