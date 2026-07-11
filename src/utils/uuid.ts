const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks whether a string is a valid UUID. Used when moving IDs generated locally
 * (which may be the legacy `'default'` wheel id, or an old `Math.random`-based
 * fallback id) into Supabase columns that are typed `uuid`.
 */
export function isValidUuid(value: string): boolean {
	return UUID_PATTERN.test(value);
}
