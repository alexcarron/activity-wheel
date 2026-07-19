/**
 * Restricts a number to the inclusive range [minimum, maximum]
 */
export const clamp = (number: number, minimum: number, maximum: number): number =>
	number < minimum ? minimum : number > maximum ? maximum : number;

/**
 * Rounds a number to 4 decimal places
 */
export const roundTo4DecimalPlaces = (value: number): number => Math.round(value * 10000) / 10000;
