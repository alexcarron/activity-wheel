/**
 * Generate a stable unique id. Uses `crypto.randomUUID` when available (everywhere in 2026 browsers), falls back to a Math.random-based id otherwise. 
 */
export function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
