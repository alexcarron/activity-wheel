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
import { getStoredActiveWheelId, persistActiveWheelId } from '../services/wheel-service';
import { createCloudWheelService, type CloudWheelService } from '../services/cloud/wheel-service';
import { useHotkey } from './useHotkey';
import { HOTKEYS } from '../constants/hotkeys';
import { toErrorMessage } from '../utils/error-message';

export interface UseWheelsApi {
	readonly wheels: readonly Wheel[];
	readonly activeWheelId: string;
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
	 * @param fromWheelId - Source wheel to copy from.
	 * @param name - Name for the new wheel.
	 * @param resetWeights - If true, all copied activities start at default weight.
	 */
	copyWheel(fromWheelId: string, name: string, resetWeights: boolean): Promise<Wheel>;
	/** Rename a wheel (inline). */
	renameWheel(id: string, name: string): Promise<void>;
	/** Delete a wheel and all its activities. Refuses if it's the only wheel. */
	deleteWheel(id: string): Promise<void>;
	/** Re-fetch the wheel list from storage and sync React state. Use after bulk import/clear. */
	reloadWheels(): Promise<void>;
}

export function useWheels(userId: string | null): UseWheelsApi {
	const wheelService: CloudWheelService = useMemo(
		() => (userId ? createCloudWheelService(userId) : localWheelService),
		[userId],
	);

	const [wheels, setWheels] = useState<readonly Wheel[]>([]);
	const [activeWheelId, setActiveWheelId] = useState<string>(() => getStoredActiveWheelId(userId ?? undefined));
	const [loading, setLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const mounted = useRef(true);

	useEffect(() => {
		mounted.current = true;
		// Intentional: this effect's job is to reset loading state before fetching
		// wheels for the newly selected backend (local vs. cloud). It also resets
		// activeWheelId to the newly-scoped stored value immediately (rather than
		// waiting on the listWheels() call below) so that useActivities/useTagFilter
		// never query the previous backend's wheelId (e.g. the local 'default' id)
		// against the new backend.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setActiveWheelId(getStoredActiveWheelId(userId ?? undefined));
		void (async () => {
			try {
				const list = await wheelService.listWheels();
				if (!mounted.current) return;
				setErrorMessage(null);

				// Sync activeWheelId to the freshly-scoped stored value (userId may have
				// changed since the initial useState ran, e.g. once auth resolves after
				// mount) and fall back if the stored wheel doesn't actually exist.
				const stored = getStoredActiveWheelId(userId ?? undefined);
				const exists = list.some((wheel) => wheel.id === stored);
				if (exists) {
					setActiveWheelId(stored);
				}
				else if (list.length > 0) {
					const fallbackId = list[0].id;
					persistActiveWheelId(fallbackId, userId ?? undefined);
					setActiveWheelId(fallbackId);
				}

				// If there are no wheels at all, create a default one.
				if (list.length === 0) {
					const defaultWheel = await wheelService.createWheel('My Wheel');
					if (!mounted.current) return;
					persistActiveWheelId(defaultWheel.id, userId ?? undefined);
					setActiveWheelId(defaultWheel.id);
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
	}, [wheelService, userId]);

	const switchWheel = useCallback(
		(id: string): void => {
			persistActiveWheelId(id, userId ?? undefined);
			setActiveWheelId(id);
			void wheelService.touchWheel(id);
			setWheels((prev) =>
				prev.map((wheel) => (wheel.id === id ? { ...wheel, lastUsedAt: Date.now() } : wheel)),
			);
		},
		[wheelService, userId],
	);

	const prevWheel = useCallback((): void => {
		setWheels((current) => {
			const index = current.findIndex((wheel) => wheel.id === activeWheelId);
			if (current.length < 2 || index === -1) return current;
			const previousWheel = current[(index - 1 + current.length) % current.length];
			persistActiveWheelId(previousWheel.id, userId ?? undefined);
			setActiveWheelId(previousWheel.id);
			void wheelService.touchWheel(previousWheel.id);
			return current.map((wheel) =>
				wheel.id === previousWheel.id ? { ...wheel, lastUsedAt: Date.now() } : wheel,
			);
		});
	}, [activeWheelId, wheelService, userId]);

	const nextWheel = useCallback((): void => {
		setWheels((current) => {
			const index = current.findIndex((wheel) => wheel.id === activeWheelId);
			if (current.length < 2 || index === -1) return current;
			const nextWheelEntry = current[(index + 1) % current.length];
			persistActiveWheelId(nextWheelEntry.id, userId ?? undefined);
			setActiveWheelId(nextWheelEntry.id);
			void wheelService.touchWheel(nextWheelEntry.id);
			return current.map((wheel) =>
				wheel.id === nextWheelEntry.id ? { ...wheel, lastUsedAt: Date.now() } : wheel,
			);
		});
	}, [activeWheelId, wheelService, userId]);

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
		async (fromWheelId: string, name: string, resetWeights: boolean): Promise<Wheel> => {
			const wheel = await wheelService.copyWheel(fromWheelId, name, resetWeights);
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
				if (activeWheelId === id && next.length > 0) {
					persistActiveWheelId(next[0].id, userId ?? undefined);
					setActiveWheelId(next[0].id);
				}
				return next;
			});
		},
		[wheels.length, activeWheelId, wheelService, userId],
	);

	const reloadWheels = useCallback(async (): Promise<void> => {
		const list = await wheelService.listWheels();
		if (!mounted.current) return;
		setWheels(list);
		// If the stored active wheel no longer exists, fall back to first.
		const stored = getStoredActiveWheelId(userId ?? undefined);
		if (!list.some((wheel) => wheel.id === stored) && list.length > 0) {
			persistActiveWheelId(list[0].id, userId ?? undefined);
			setActiveWheelId(list[0].id);
		}
	}, [wheelService, userId]);

	return useMemo<UseWheelsApi>(
		() => ({
			wheels,
			activeWheelId,
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
			activeWheelId,
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
