/**
 * Extracts a human-readable message from a thrown value. Handles plain Error
 * instances as well as error-shaped objects that aren't Error instances, such
 * as Supabase's PostgrestError.
 */
export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'object' && error !== null && 'message' in error) {
		return String((error as { message: unknown }).message);
	}
	return String(error);
}
