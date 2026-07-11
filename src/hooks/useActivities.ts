/**
 * This custom React hook is the single source of truth for the activities belonging to a particular wheel id.
 * Signed-out users are backed by IndexedDB (local-only); signed-in users are backed by Supabase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as localActivityService from '../services/activity-service';
import { totalEffective } from '../services/activity-service';
import * as localTagService from '../services/tag-service';
import { createCloudActivityService, type CloudActivityService } from '../services/cloud/activity-service';
import { createCloudTagService } from '../services/cloud/tag-service';
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
	updateTags(id: string, tags: string[]): Promise<void>;
	reload(): Promise<void>;
	clearEverything(): Promise<void>;
}

export function useActivities(wheelId: string, userId: string | null): UseActivitiesApi {
	const activityService: CloudActivityService = useMemo(
		() => (userId ? createCloudActivityService(userId) : localActivityService),
		[userId],
	);
	const ensureTagsExist = useMemo(
		() => (userId ? createCloudTagService(userId).ensureTagsExist : localTagService.ensureTagsExist),
		[userId],
	);

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
			const nextActivities = await activityService.listActivities(wheelRef.current);
			if (isMounted.current) setActivities(nextActivities);
		}
		catch (error) {
			if (isMounted.current) setError(toErrorMessage(error));
		}
	}, [activityService]);

	// Re-load whenever the wheelId or backend changes.
	// An empty wheelId means useWheels hasn't resolved an active wheel yet
	// (e.g. a freshly signed-in cloud account before its first wheel loads/is
	// created) — there's nothing valid to query yet, so wait rather than fetch.
	useEffect(() => {
		isMounted.current = true;
		// Intentional: this effect's job is to reset loading state for the newly
		// active wheel before fetching its activities.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		if (!wheelId) {
			setActivities([]);
			setError(null);
			return;
		}
		void (async () => {
			try {
				const next = await activityService.listActivities(wheelId);
				if (isMounted.current) {
					setActivities(next);
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
		async (id: string, tags: string[]): Promise<void> => {
			try {
				const updated = await activityService.updateActivityTags(id, tags);
				setActivities((prev) => prev.map((activity) => (activity.id === id ? updated : activity)));
				await ensureTagsExist(wheelRef.current, tags);
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activityService, ensureTagsExist],
	);

	const applyFeedback = useCallback(
		async (id: string, action: FeedbackAction): Promise<void> => {
			try {
				const poolTotal = totalEffective(activities, Date.now());
				const updated = await activityService.recordFeedback(id, action, poolTotal);
				setActivities((prev) => prev.map((activity) => (activity.id === id ? updated : activity)));
			}
			catch (error) {
				setError(toErrorMessage(error));
				throw error;
			}
		},
		[activities, activityService],
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

