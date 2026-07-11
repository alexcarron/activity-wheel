/** Access + unlock flow for shared wheels. */

import { requireSupabase } from './supabase-client';

const UNLOCKED_SHARED_WHEELS_KEY = 'unlockedSharedWheelIds';

export function getUnlockedSharedWheelIds(): string[] {
	const raw = localStorage.getItem(UNLOCKED_SHARED_WHEELS_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
	}
	catch {
		return [];
	}
}

export function markSharedWheelUnlocked(sharedWheelId: string): void {
	const current = new Set(getUnlockedSharedWheelIds());
	current.add(sharedWheelId);
	localStorage.setItem(UNLOCKED_SHARED_WHEELS_KEY, JSON.stringify([...current]));
}

export async function ensureAnonymousOrExistingSession(): Promise<void> {
	const supabase = requireSupabase();
	const { data } = await supabase.auth.getSession();
	if (data.session) return;
	const { error } = await supabase.auth.signInAnonymously();
	if (error) throw error;
}

export async function doesSharedWheelExist(sharedWheelId: string): Promise<boolean> {
	const supabase = requireSupabase();
	const { data, error } = await supabase.rpc('does_shared_wheel_exist', {
		wheel_id_param: sharedWheelId,
	});
	if (error) throw error;
	return data === true;
}

export async function unlockSharedWheel(sharedWheelId: string, password: string): Promise<boolean> {
	await ensureAnonymousOrExistingSession();
	const supabase = requireSupabase();
	const { data, error } = await supabase.rpc('unlock_shared_wheel', {
		wheel_id_param: sharedWheelId,
		password_param: password,
	});
	if (error) throw error;
	const unlocked = data === true;
	if (unlocked) markSharedWheelUnlocked(sharedWheelId);
	return unlocked;
}
