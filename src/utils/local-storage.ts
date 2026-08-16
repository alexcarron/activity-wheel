/**
 * Every localStorage key this app persists, plus a thin, safe wrapper around localStorage.
 * All reads/writes to localStorage anywhere in the app should go through this file.
 */

export const LOCAL_STORAGE_KEYS = {
	debugState: 'activity-wheel.debug',
	activeWheelID: 'activeWheelId',
	persistedAnonymousSession: 'persistedAnonymousSession',
	showTags: 'activity-wheel.showTags',
	showDateAdded: 'activity-wheel.showDateAdded',
} as const;

export function saveStringToLocalStorage(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	}
	catch {
		// Ignore quota errors. Local UI preferences are non-critical.
	}
}

export function loadStringFromLocalStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	}
	catch {
		return null;
	}
}

export function saveJSONToLocalStorage<T>(key: string, value: T): void {
	saveStringToLocalStorage(key, JSON.stringify(value));
}

export function loadJSONFromLocalStorage<T>(key: string, fallback: T): T {
	const raw = loadStringFromLocalStorage(key);
	if (raw === null) return fallback;
	try {
		return JSON.parse(raw) as T;
	}
	catch {
		return fallback;
	}
}

export function removeFromLocalStorage(key: string): void {
	try {
		localStorage.removeItem(key);
	}
	catch {
		// Ignore quota/security errors.
	}
}
