/** Access + unlock flow for shared wheels. */

import type { Session } from '@supabase/supabase-js';
import { requireSupabase } from './supabase-client';
import { LOCAL_STORAGE_KEYS, loadJSONFromLocalStorage, saveJSONToLocalStorage } from '../utils/local-storage';

interface PersistedAnonymousSession {
	accessToken: string;
	refreshToken: string;
}

/** Keeps the anonymous session restorable in this browser across refreshes and sign-in/sign-out cycles, without following the user to another browser or device. */
export function persistAnonymousSessionIfPresent(session: Session | null): void {
	if (!session?.user.is_anonymous) return;
	const persisted: PersistedAnonymousSession = {
		accessToken: session.access_token,
		refreshToken: session.refresh_token,
	};
	saveJSONToLocalStorage(LOCAL_STORAGE_KEYS.persistedAnonymousSession, persisted);
}

function readPersistedAnonymousSession(): PersistedAnonymousSession | null {
	const parsed = loadJSONFromLocalStorage<Partial<PersistedAnonymousSession> | null>(
		LOCAL_STORAGE_KEYS.persistedAnonymousSession,
		null,
	);
	if (typeof parsed?.accessToken === 'string' && typeof parsed?.refreshToken === 'string') return parsed as PersistedAnonymousSession;
	return null;
}

export async function ensureAnonymousOrExistingSession(): Promise<void> {
	const supabase = requireSupabase();
	const { data } = await supabase.auth.getSession();
	if (data.session) return;

	const persistedAnonymousSession = readPersistedAnonymousSession();
	if (persistedAnonymousSession) {
		const { data: restoredData, error: restoreError } = await supabase.auth.setSession({
			access_token: persistedAnonymousSession.accessToken,
			refresh_token: persistedAnonymousSession.refreshToken,
		});
		if (!restoreError && restoredData.session) {
			persistAnonymousSessionIfPresent(restoredData.session);
			return;
		}
	}

	const { data: signInData, error } = await supabase.auth.signInAnonymously();
	if (error) throw error;
	persistAnonymousSessionIfPresent(signInData.session);
}

export async function doesSharedWheelExist(sharedWheelID: string): Promise<boolean> {
	const supabase = requireSupabase();
	const { data, error } = await supabase.rpc('does_shared_wheel_exist', {
		wheel_id_param: sharedWheelID,
	});
	if (error) throw error;
	return data === true;
}

export async function unlockSharedWheel(sharedWheelID: string, password: string): Promise<boolean> {
	await ensureAnonymousOrExistingSession();
	const supabase = requireSupabase();
	const { data, error } = await supabase.rpc('unlock_shared_wheel', {
		wheel_id_param: sharedWheelID,
		password_param: password,
	});
	if (error) throw error;
	return data === true;
}
