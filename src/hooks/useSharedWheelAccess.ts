/** Resolves which shared wheels this browser/account has access to, and exposes the unlock flow for a wheel named by the URL. */

import { useCallback, useEffect, useState } from 'react';
import type { Wheel } from '../domain-logic/types';
import { onAuthStateChange } from '../services/auth-service';
import { getSharedWheelMetadata } from '../services/cloud/shared-wheel-service';
import {
	doesSharedWheelExist,
	getUnlockedSharedWheelIds,
	persistAnonymousSessionIfPresent,
	unlockSharedWheel,
} from '../services/shared-wheel-access-service';
import { toErrorMessage } from '../utils/error-message';

export interface UseSharedWheelAccessApi {
	readonly loading: boolean;
	/** Whether sharedWheelIdFromUrl (if any) is currently accessible. Always false when sharedWheelIdFromUrl is null. */
	readonly hasAccess: boolean;
	/** Display name for the password gate, falling back to a title-cased slug before membership is confirmed. */
	readonly wheelName: string;
	/** Every shared wheel this browser/account currently has access to, for rendering as extra tabs. */
	readonly unlockedWheels: readonly Wheel[];
	/** True when sharedWheelIdFromUrl doesn't match any shared wheel at all, as opposed to one that just isn't unlocked yet. */
	readonly wasSharedWheelNotFound: boolean;
	readonly errorMessage: string | null;
	readonly unlocking: boolean;
	unlock(password: string): Promise<boolean>;
}

function titleCaseFromSlug(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export function useSharedWheelAccess(sharedWheelIdFromUrl: string | null): UseSharedWheelAccessApi {
	const [loading, setLoading] = useState(true);
	const [unlockedWheels, setUnlockedWheels] = useState<readonly Wheel[]>([]);
	const [wasSharedWheelNotFound, setWasSharedWheelNotFound] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [unlocking, setUnlocking] = useState(false);
	// Membership is scoped to whichever Supabase auth session (Google or anonymous) is active, so a sign-in/sign-out must re-verify access rather than trust what was resolved under the previous session.
	const [sessionUserId, setSessionUserId] = useState<string | null>(null);

	useEffect(() => {
		const subscription = onAuthStateChange((session) => {
			setSessionUserId(session?.user?.id ?? null);
			persistAnonymousSessionIfPresent(session);
		});
		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		let cancelled = false;
		const idsToCheck = new Set(getUnlockedSharedWheelIds());
		if (sharedWheelIdFromUrl) idsToCheck.add(sharedWheelIdFromUrl);

		// eslint-disable-next-line react-hooks/set-state-in-effect
		setWasSharedWheelNotFound(false);

		if (idsToCheck.size === 0) {
			setLoading(false);
			return;
		}

		setLoading(true);
		void (async () => {
			const resolved = await Promise.all(
				[...idsToCheck].map((id) => getSharedWheelMetadata(id).catch(() => undefined)),
			);
			if (cancelled) return;
			const resolvedWheels = resolved.filter((wheel): wheel is Wheel => wheel !== undefined);
			setUnlockedWheels(resolvedWheels);

			const wasUrlWheelResolved = resolvedWheels.some((wheel) => wheel.id === sharedWheelIdFromUrl);
			if (sharedWheelIdFromUrl && !wasUrlWheelResolved) {
				const exists = await doesSharedWheelExist(sharedWheelIdFromUrl).catch(() => true);
				if (cancelled) return;
				setWasSharedWheelNotFound(!exists);
			}

			setLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [sharedWheelIdFromUrl, sessionUserId]);

	const unlock = useCallback(
		async (password: string): Promise<boolean> => {
			if (!sharedWheelIdFromUrl) return false;
			setUnlocking(true);
			setErrorMessage(null);
			try {
				const success = await unlockSharedWheel(sharedWheelIdFromUrl, password);
				if (!success) {
					setErrorMessage('Incorrect password.');
					return false;
				}
				const metadata = await getSharedWheelMetadata(sharedWheelIdFromUrl);
				if (metadata) {
					setUnlockedWheels((prev) => [...prev.filter((wheel) => wheel.id !== metadata.id), metadata]);
				}
				return true;
			}
			catch (error) {
				setErrorMessage(toErrorMessage(error));
				return false;
			}
			finally {
				setUnlocking(false);
			}
		},
		[sharedWheelIdFromUrl],
	);

	const hasAccess = sharedWheelIdFromUrl
		? unlockedWheels.some((wheel) => wheel.id === sharedWheelIdFromUrl)
		: false;

	const wheelNameFromMetadata = sharedWheelIdFromUrl
		? unlockedWheels.find((wheel) => wheel.id === sharedWheelIdFromUrl)?.name
		: undefined;
		
	const wheelName = wheelNameFromMetadata ?? (sharedWheelIdFromUrl ? titleCaseFromSlug(sharedWheelIdFromUrl) : '');

	return { loading, hasAccess, wheelName, unlockedWheels, wasSharedWheelNotFound, errorMessage, unlocking, unlock };
}
