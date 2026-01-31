/**
 * Calculates the percentage of a value relative to a total.
 * @param {number} value - The value for which to calculate the percentage.
 * @param {number} total - The total value against which to calculate the percentage.
 * @returns {string} - The percentage formatted with two digits after the decimal point.
 * If either value or total is not a number, or if total is zero, returns an error message.
 */
export function calculatePercentage(value: number, total: number) {
  // Check if the values are numbers
  if (typeof value !== "number" || typeof total !== "number" || total === 0) {
    return "Error: Please provide valid numbers and a total different than zero.";
  }

  // Calculate the percentage
  const percentage = (value / total) * 100;

  // Format the percentage with two digits after the decimal point maximum
  const formattedPercentage = percentage.toFixed(2);

  return formattedPercentage;
}
