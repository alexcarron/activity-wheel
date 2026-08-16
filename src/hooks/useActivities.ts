import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as localActivityService from '../services/activity-service';
import { createCloudActivityService, type CloudActivityService } from '../services/cloud/activity-service';
import { createSharedActivityService } from '../services/cloud/shared-activity-service';
import { createBackgroundSaveQueue } from '../services/background-save-queue';
import { useSharedWheelRealtimeSync, type SharedActivityChange } from './shared-wheel-realtime';
import { applyFeedbackToActivity } from '../domain-logic/weight-logic/weight-feedback-response-logic';
import { newActivity } from '../domain-logic/activity-logic/activity-factory';
import type { Activity, FeedbackAction } from '../domain-logic/types';
import { newID } from '../utils/id';
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
	onActivityChangedRemotely?: (sharedActivityChange: SharedActivityChange) => void,
): UseActivitiesApi {
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

	const latestActivitiesRef = useRef(activities);

	const latestActivityServiceRef = useRef(activityService);

	const backgroundSaveQueueRef = useRef(createBackgroundSaveQueue());
	const backgroundSaveQueue = backgroundSaveQueueRef.current;

	useEffect(() => {
		wheelRef.current = wheelId;
	}, [wheelId]);

	useEffect(() => {
		latestActivitiesRef.current = activities;
	}, [activities]);

	useEffect(() => {
		latestActivityServiceRef.current = activityService;
	}, [activityService]);

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
		onActivityChangedRemotely?.(change);
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
	}, [onActivityChangedRemotely]);
	useSharedWheelRealtimeSync(sharedWheelID, applyRealtimeChange);

	const saveInBackground = useCallback(
		(activityID: string, saveTask: () => Promise<void>): void => {
			const originatingWheelID = wheelRef.current;
			const originatingActivityService = latestActivityServiceRef.current;
			backgroundSaveQueue.addToQueue(activityID, async () => {
				try {
					await saveTask();
				}
				catch (error) {
					if (!isMounted.current) return;
					setError(toErrorMessage(error));
					const isStillOnOriginatingWheelAndBackend =
						wheelRef.current === originatingWheelID && latestActivityServiceRef.current === originatingActivityService;
					if (isStillOnOriginatingWheelAndBackend) await reload();
				}
			});
		},
		[backgroundSaveQueue, reload],
	);

	const add = useCallback(
		async (name: string): Promise<void> => {
			const trimmedName = name.trim();
			if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
			const activity = newActivity(newID(), trimmedName, Date.now(), wheelRef.current);
			const nextActivities = [...latestActivitiesRef.current, activity];
			latestActivitiesRef.current = nextActivities;
			setActivities(nextActivities);
			saveInBackground(activity.id, () => activityService.bulkPut([activity]));
		},
		[activityService, saveInBackground],
	);

	const rename = useCallback(
		async (id: string, name: string): Promise<void> => {
			const trimmedName = name.trim();
			if (trimmedName.length === 0) throw new Error('Activity name cannot be empty');
			const current = latestActivitiesRef.current.find((activity) => activity.id === id);
			if (!current) return;
			const nextActivity: Activity = { ...current, name: trimmedName };
			const nextActivities = latestActivitiesRef.current.map((activity) => (activity.id === id ? nextActivity : activity));
			latestActivitiesRef.current = nextActivities;
			setActivities(nextActivities);
			saveInBackground(id, () => activityService.bulkPut([nextActivity]));
		},
		[activityService, saveInBackground],
	);

	const remove = useCallback(
		async (id: string): Promise<void> => {
			const nextActivities = latestActivitiesRef.current.filter((activity) => activity.id !== id);
			latestActivitiesRef.current = nextActivities;
			setActivities(nextActivities);
			saveInBackground(id, () => activityService.deleteActivity(id));
		},
		[activityService, saveInBackground],
	);

	const updateTags = useCallback(
		async (id: string, tagIds: string[]): Promise<void> => {
			const current = latestActivitiesRef.current.find((activity) => activity.id === id);
			if (!current) return;
			const nextActivity: Activity = { ...current, tagIds };
			const nextActivities = latestActivitiesRef.current.map((activity) => (activity.id === id ? nextActivity : activity));
			latestActivitiesRef.current = nextActivities;
			setActivities(nextActivities);
			saveInBackground(id, () => activityService.bulkPut([nextActivity]));
		},
		[activityService, saveInBackground],
	);

	const applyFeedback = useCallback(
		async (id: string, action: FeedbackAction): Promise<void> => {
			const current = latestActivitiesRef.current.find((activity) => activity.id === id);
			if (!current) return;
			const nextActivity = applyFeedbackToActivity(current, action, Date.now());
			const nextActivities = latestActivitiesRef.current.map((activity) => (activity.id === id ? nextActivity : activity));
			latestActivitiesRef.current = nextActivities;
			setActivities(nextActivities);
			saveInBackground(id, () => activityService.bulkPut([nextActivity]));
		},
		[activityService, saveInBackground],
	);

	const clearEverything = useCallback(async (): Promise<void> => {
		await activityService.clearWheelActivities(wheelRef.current);
		latestActivitiesRef.current = [];
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
