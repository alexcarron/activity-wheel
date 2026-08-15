/**
 * `useWheels`. Owns the list of wheels and the currently active wheel.
 * Signed-out users are backed by IndexedDB (local-only); signed-in users are backed
 * by Supabase, private to their account. The active wheel ID is persisted in
 * localStorage (scoped per signed-in user) so it survives page reloads. When the
 * active wheel changes, downstream hooks (useActivities, useTagFilter) re-initialise
 * automatically because they receive the new wheelId as a prop.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Wheel } from '../domain-logic/types';
import * as localWheelService from '../services/wheel-service';
import { getStoredActiveWheelID, persistActiveWheelID } from '../services/wheel-service';
import { createCloudWheelService, type CloudWheelService } from '../services/cloud/wheel-service';
import { useHotkey } from './useHotkey';
import { HOTKEYS } from '../constants/hotkeys';
import { toErrorMessage } from '../utils/error-message';

export interface UseWheelsApi {
	readonly wheels: readonly Wheel[];
	readonly activeWheelID: string;
	readonly loading: boolean;
	readonly errorMessage: string | null;
	/** Switch the active wheel. Resets session + tag filter via downstream hooks. */
	switchWheel(id: string): void;
	/** Cycle to the wheel before the active one (wraps). */
	prevWheel(): void;
	/** Cycle to the wheel after the active one (wraps). */
	nextWheel(): void;
	/** Create a brand-new empty wheel. */
	createWheel(name: string): Promise<Wheel>;
	/**
	 * Duplicate a wheel.
	 * @param fromWheelID - Source wheel to copy from.
	 * @param name - Name for the new wheel.
	 * @param resetWeights - If true, all copied activities start at default weight.
	 */
	copyWheel(fromWheelID: string, name: string, resetWeights: boolean): Promise<Wheel>;
	/** Rename a wheel (inline). */
	renameWheel(id: string, name: string): Promise<void>;
	/** Delete a wheel and all its activities. Refuses if it's the only wheel. */
	deleteWheel(id: string): Promise<void>;
	/** Re-fetch the wheel list from storage and sync React state. Use after bulk import/clear. */
	reloadWheels(): Promise<void>;
}

export function useWheels(userID: string | null, authLoading: boolean): UseWheelsApi {
	const wheelService: CloudWheelService = useMemo(
		() => (userID ? createCloudWheelService(userID) : localWheelService),
		[userID],
	);

	const [wheels, setWheels] = useState<readonly Wheel[]>([]);
	const [activeWheelID, setActiveWheelID] = useState<string>(() => getStoredActiveWheelID(userID ?? undefined));
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		// Intentional: this effect's job is to reset loading state before fetching wheels for the newly selected backend (local vs. cloud). It also resets activeWheelID to the newly-scoped stored value immediately (rather than waiting on the getWheelsInOrder() call below) so that useActivities/useTagFilter never query the previous backend's wheelId (e.g. the local 'default' id) against the new backend.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		// While useAuth is still restoring the session, userID is always null, which would make this hook fetch as the signed-out/local backend even for a user who is about to be signed back in. Wait until auth resolves before fetching, so we never briefly show local data to a soon-to-be-signed-in user.
		if (authLoading) return;
		setActiveWheelID(getStoredActiveWheelID(userID ?? undefined));
		void (async () => {
			try {
				const list = await wheelService.getWheelsInOrder();
				if (!mounted.current) return;
				setErrorMessage(null);

				// Sync activeWheelID to the freshly-scoped stored value (userID may have
				// changed since the initial useState ran, e.g. once auth resolves after
				// mount) and fall back if the stored wheel doesn't actually exist.
				const stored = getStoredActiveWheelID(userID ?? undefined);
				const exists = list.some((wheel) => wheel.id === stored);
				if (exists) {
					setActiveWheelID(stored);
				}
				else if (list.length > 0) {
					const fallbackID = list[0].id;
					persistActiveWheelID(fallbackID, userID ?? undefined);
					setActiveWheelID(fallbackID);
				}

				// If there are no wheels at all, create a default one.
				if (list.length === 0) {
					const defaultWheel = await wheelService.createWheel('My Wheel');
					if (!mounted.current) return;
					persistActiveWheelID(defaultWheel.id, userID ?? undefined);
					setActiveWheelID(defaultWheel.id);
					setWheels([defaultWheel]);
				}
				else {
					setWheels(list);
				}
			}
			catch (error) {
				if (mounted.current) setErrorMessage(toErrorMessage(error));
			}
			finally {
				if (mounted.current) setLoading(false);
			}
		})();
		return () => {
			mounted.current = false;
		};
	}, [wheelService, userID, authLoading]);

	const switchWheel = useCallback(
		(id: string): void => {
			persistActiveWheelID(id, userID ?? undefined);
			setActiveWheelID(id);
			void wheelService.recordWheelBeingUsed(id);
			setWheels((prev) =>
				prev.map((wheel) => (wheel.id === id ? { ...wheel, lastUsedAt: Date.now() } : wheel)),
			);
		},
		[wheelService, userID],
	);

	const prevWheel = useCallback((): void => {
		setWheels((current) => {
			const index = current.findIndex((wheel) => wheel.id === activeWheelID);
			if (current.length < 2 || index === -1) return current;
			const previousWheel = current[(index - 1 + current.length) % current.length];
			persistActiveWheelID(previousWheel.id, userID ?? undefined);
			setActiveWheelID(previousWheel.id);
			void wheelService.recordWheelBeingUsed(previousWheel.id);
			return current.map((wheel) =>
				wheel.id === previousWheel.id ? { ...wheel, lastUsedAt: Date.now() } : wheel,
			);
		});
	}, [activeWheelID, wheelService, userID]);

	const nextWheel = useCallback((): void => {
		setWheels((current) => {
			const index = current.findIndex((wheel) => wheel.id === activeWheelID);
			if (current.length < 2 || index === -1) return current;
			const nextWheelEntry = current[(index + 1) % current.length];
			persistActiveWheelID(nextWheelEntry.id, userID ?? undefined);
			setActiveWheelID(nextWheelEntry.id);
			void wheelService.recordWheelBeingUsed(nextWheelEntry.id);
			return current.map((wheel) =>
				wheel.id === nextWheelEntry.id ? { ...wheel, lastUsedAt: Date.now() } : wheel,
			);
		});
	}, [activeWheelID, wheelService, userID]);

	useHotkey(HOTKEYS.SWITCH_TO_PREV_WHEEL.code, prevWheel, wheels.length > 1);
	useHotkey(HOTKEYS.SWITCH_TO_NEXT_WHEEL.code, nextWheel, wheels.length > 1);

	const createWheel = useCallback(
		async (name: string): Promise<Wheel> => {
			const wheel = await wheelService.createWheel(name);
			if (mounted.current) setWheels((prev) => [...prev, wheel]);
			return wheel;
		},
		[wheelService],
	);

	const copyWheel = useCallback(
		async (fromWheelID: string, name: string, resetWeights: boolean): Promise<Wheel> => {
			const wheel = await wheelService.copyWheel(fromWheelID, name, resetWeights);
			if (mounted.current) setWheels((prev) => [...prev, wheel]);
			return wheel;
		},
		[wheelService],
	);

	const renameWheel = useCallback(
		async (id: string, name: string): Promise<void> => {
			const updated = await wheelService.renameWheel(id, name);
			if (mounted.current) {
				setWheels((prev) => prev.map((wheel) => (wheel.id === id ? updated : wheel)));
			}
		},
		[wheelService],
	);

	const deleteWheel = useCallback(
		async (id: string): Promise<void> => {
			if (wheels.length <= 1) throw new Error('Cannot delete the only wheel');
			await wheelService.deleteWheel(id);
			setWheels((prev) => {
				const next = prev.filter((wheel) => wheel.id !== id);
				// If we deleted the active wheel, switch to the first remaining one.
				if (activeWheelID === id && next.length > 0) {
					persistActiveWheelID(next[0].id, userID ?? undefined);
					setActiveWheelID(next[0].id);
				}
				return next;
			});
		},
		[wheels.length, activeWheelID, wheelService, userID],
	);

	const reloadWheels = useCallback(async (): Promise<void> => {
		const list = await wheelService.getWheelsInOrder();
		if (!mounted.current) return;
		setWheels(list);
		// If the stored active wheel no longer exists, fall back to first.
		const stored = getStoredActiveWheelID(userID ?? undefined);
		if (!list.some((wheel) => wheel.id === stored) && list.length > 0) {
			persistActiveWheelID(list[0].id, userID ?? undefined);
			setActiveWheelID(list[0].id);
		}
	}, [wheelService, userID]);

	return useMemo<UseWheelsApi>(
		() => ({
			wheels,
			activeWheelID,
			loading,
			errorMessage,
			switchWheel,
			prevWheel,
			nextWheel,
			createWheel,
			copyWheel,
			renameWheel,
			deleteWheel,
			reloadWheels,
		}),
		[
			wheels,
			activeWheelID,
			loading,
			errorMessage,
			switchWheel,
			prevWheel,
			nextWheel,
			createWheel,
			copyWheel,
			renameWheel,
			deleteWheel,
			reloadWheels,
		],
	);
}
