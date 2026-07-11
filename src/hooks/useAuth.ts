/**
 * `useAuth`. Owns the Supabase session and the current user's profile.
 * Restores any existing session on mount and subscribes to live auth changes
 * (sign-in, sign-out, token refresh) so the rest of the app can gate on `user`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
	fetchProfile,
	getSession,
	onAuthStateChange,
	signInWithGoogle,
	signOut as svcSignOut,
	updateDisplayName as svcUpdateDisplayName,
	resolveDisplayName,
	type Profile,
} from '../services/auth-service';

export interface UseAuthApi {
	readonly user: User | null;
	readonly profile: Profile | null;
	readonly displayName: string | null;
	readonly loading: boolean;
	signInWithGoogle(): Promise<void>;
	signOut(): Promise<void>;
	updateDisplayName(name: string): Promise<void>;
}

export function useAuth(): UseAuthApi {
	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);
	const mounted = useRef(true);

	const loadProfile = useCallback(async (nextUser: User | null): Promise<void> => {
		if (!nextUser) {
			if (mounted.current) setProfile(null);
			return;
		}
		const nextProfile = await fetchProfile(nextUser.id);
		if (mounted.current) setProfile(nextProfile);
	}, []);

	useEffect(() => {
		mounted.current = true;

		void (async () => {
			const session = await getSession();
			if (!mounted.current) return;
			setUser(session?.user ?? null);
			await loadProfile(session?.user ?? null);
			if (mounted.current) setLoading(false);
		})();

		const subscription = onAuthStateChange((session) => {
			setUser(session?.user ?? null);
			void loadProfile(session?.user ?? null);
		});

		return () => {
			mounted.current = false;
			subscription.unsubscribe();
		};
	}, [loadProfile]);

	const updateDisplayName = useCallback(
		async (name: string): Promise<void> => {
			if (!user) throw new Error('Cannot update display name while signed out');
			const nextProfile = await svcUpdateDisplayName(user.id, name);
			if (mounted.current) setProfile(nextProfile);
		},
		[user],
	);

	const signOut = useCallback(async (): Promise<void> => {
		await svcSignOut();
		if (mounted.current) {
			setUser(null);
			setProfile(null);
		}
	}, []);

	const displayName = useMemo(
		() => (user ? resolveDisplayName(user, profile) : null),
		[user, profile],
	);

	return useMemo<UseAuthApi>(
		() => ({ user, profile, displayName, loading, signInWithGoogle, signOut, updateDisplayName }),
		[user, profile, displayName, loading, signOut, updateDisplayName],
	);
}
