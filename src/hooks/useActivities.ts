/**
 * This custom React hook is the single source of truth for the activities belonging to a particular wheel id.
 * Signed-out users are backed by IndexedDB (local-only); signed-in users are backed by Supabase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as localActivityService from '../services/activity-service';
import { createCloudActivityService, type CloudActivityService } from '../services/cloud/activity-service';
import { createSharedActivityService } from '../services/cloud/shared-activity-service';
import { useSharedWheelRealtimeSync, type SharedActivityChange } from './shared-wheel-realtime';
import type { Activity, FeedbackAction } from '../domain-logic/types';
import { toErrorMessage } from '../utils/error-message';

interface UseActivitiesApi {
	readonly activities: readonly Activity[];
	readonly isLoading: boolean;
	readonly errorMessage: string | null;
	add(name: string): Promise<void>;
	rename(id: string, name: string): Promise<void>;
	remove(id: string): Promise<void>;
	applyFeedback(id: string, action: FeedbackAction): Promise<void>;
	updateTags(id: string, tagIds: string[]): Promise<void>;
	reload(): Promise<void>;
	clearEverything(): Promise<void>;
}

export function useActivities(
	wheelId: string,
	userID: string | null,
	sharedWheelID: string | null,
	/** Fires for every realtime change (shared wheels only), before it's merged into state. */
	onRemoteActivityChange?: (change: SharedActivityChange) => void,
): UseActivitiesApi {
	// Memoized separately from the owned-wheel backend so that userID changing (e.g. sign-out) while a shared wheel is active can't produce a new activityService/ensureTagsExist reference and retrigger the fetch effect below under a session that no longer has access.
	const sharedActivityService = useMemo(() => createSharedActivityService(), []);
	const ownedActivityService = useMemo(
		() => (userID ? createCloudActivityService(userID) : localActivityService),
		[userID],
	);
	const activityService: CloudActivityService = sharedWheelID ? sharedActivityService : ownedActivityService;

	const [activities, setActivities] = useState<readonly Activity[]>([]);
	const [isLoading, setLoading] = useState(true);
	const [errorMessage, setError] = useState<string | null>(null);
	const isMounted = useRef(true);
	const wheelRef = useRef(wheelId);

	useEffect(() => {
		wheelRef.current = wheelId;
	}, [wheelId]);

	const reload = useCallback(async (): Promise<void> => {
		try {
			const nextActivities = await activityService.loadActivitiesOfWheel(wheelRef.current);
			if (isMounted.current) setActivities(nextActivities);
		}
		catch (error) {
			if (isMounted.current) setError(toErrorMessage(error));
		}
	}, [activityService]);

	useEffect(() => {
		isMounted.current = true;
		setLoading(true);
		if (!wheelId) {
			setActivities([]);
			setError(null);
			return;
		}
		void (async () => {
			try {
				const loadedActivities = await activityService.loadActivitiesOfWheel(wheelId);
				if (isMounted.current) {
					setActivities(loadedActivities);
					setError(null);
				}
			}
			catch (error) {
				if (isMounted.current) setError(toErrorMessage(error));
			}
			finally {
				if (isMounted.current) setLoading(false);
			}
		})();
		return () => {
			isMounted.current = false;
		};
	}, [wheelId, activityService]);

	const applyRealtimeChange = useCallback((change: SharedActivityChange): void => {
		onRemoteActivityChange?.(change);
		if (change.type === 'delete') {
			setActivities((prev) => prev.filter((activity) => activity.id !== change.activityID));
			return;
		}
		setActivities((prev) => {
			const exists = prev.some((activity) => activity.id === change.activity.id);
			return exists
				? prev.map((activity) => (activity.id === change.activity.id ? change.activity : activity))
				: [...prev, change.activity];
		});
	}, [onRemoteActivityChange]);
	useSharedWheelRealtimeSync(sharedWheelID, applyRealtimeChange);

	const add = useCallback(
		async (name: string): Promise<void> => {
			try {
				const activity = await activityService.addActivity(name, wheelRef.current);
				setActivities((prev) => [...prev, activity]);
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService],
	);

	const rename = useCallback(
		async (id: string, name: string): Promise<void> => {
			try {
				const updated = await activityService.renameActivity(id, name);
				setActivities((prev) => prev.map((activity) => (activity.id === id ? updated : activity)));
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService],
	);

	const remove = useCallback(
		async (id: string): Promise<void> => {
			try {
				await activityService.deleteActivity(id);
				setActivities((prev) => prev.filter((activity) => activity.id !== id));
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService],
	);

	const updateTags = useCallback(
		async (id: string, tagIds: string[]): Promise<void> => {
			try {
				const updated = await activityService.updateActivityTagIDs(id, tagIds);
				setActivities((prev) => prev.map((activity) => (activity.id === id ? updated : activity)));
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService],
	);

	const applyFeedback = useCallback(
		async (id: string, action: FeedbackAction): Promise<void> => {
			try {
				const updatedActivities = await activityService.recordFeedback(id, action);
				setActivities((prev) => prev.map((activity) => (activity.id === id ? updatedActivities : activity)));
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService],
	);

	const clearEverything = useCallback(async (): Promise<void> => {
		await activityService.clearWheelActivities(wheelRef.current);
		setActivities([]);
	}, [activityService]);

	return useMemo<UseActivitiesApi>(
		() => ({
			activities,
			isLoading,
			errorMessage,
			add,
			rename,
			remove,
			applyFeedback,
			updateTags,
			reload,
			clearEverything,
		}),
		[
			activities,
			isLoading,
			errorMessage,
			add,
			rename,
			remove,
			applyFeedback,
			updateTags,
			reload,
			clearEverything,
		],
	);
}

