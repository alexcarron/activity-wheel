/** The current user's chosen activities on the active wheel. Every change shows instantly and saves in the background. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, ChosenActivity } from '../domain-logic/types';
import * as localChosenActivityService from '../services/chosen-activity-service';
import {
	createCloudChosenActivityService,
	createSharedChosenActivityService,
	type ChosenActivityService,
} from '../services/cloud/chosen-activity-service';
import { createBackgroundSaveQueue } from '../services/background-save-queue';
import { toErrorMessage } from '../utils/error-message';

export interface ChosenActivityWithDetails {
	readonly chosenActivity: ChosenActivity;
	readonly activity: Activity;
}

interface UseChosenActivitiesApi {
	readonly chosenActivitiesNewestFirst: readonly ChosenActivityWithDetails[];
	readonly errorMessage: string | null;
	findChosenActivity(activityID: string): ChosenActivity | undefined;
	choose(activityID: string): void;
	remove(activityID: string): void;
	restore(chosenActivity: ChosenActivity): void;
}

export function useChosenActivities({
	wheelID,
	userID,
	sharedWheelID,
	activities,
}: {
	wheelID: string;
	userID: string | null;
	sharedWheelID: string | null;
	activities: readonly Activity[];
}): UseChosenActivitiesApi {
	const service = useMemo<ChosenActivityService>(() => {
		if (sharedWheelID) return createSharedChosenActivityService();
		if (userID) return createCloudChosenActivityService();
		return localChosenActivityService;
	}, [sharedWheelID, userID]);

	const [chosenActivities, setChosenActivities] = useState<readonly ChosenActivity[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const latestChosenActivitiesRef = useRef(chosenActivities);
	const backgroundSaveQueueRef = useRef(createBackgroundSaveQueue());

	const replaceChosenActivities = useCallback((nextChosenActivities: readonly ChosenActivity[]): void => {
		latestChosenActivitiesRef.current = nextChosenActivities;
		setChosenActivities(nextChosenActivities);
	}, []);

	useEffect(() => {
		let isCurrentLoad = true;
		void (async () => {
			try {
				const loadedChosenActivities = wheelID ? await service.listChosenActivitiesOfWheel(wheelID) : [];
				if (!isCurrentLoad) return;
				replaceChosenActivities(loadedChosenActivities);
				setErrorMessage(null);
			}
			catch (error) {
				if (isCurrentLoad) setErrorMessage(toErrorMessage(error));
			}
		})();
		return () => {
			isCurrentLoad = false;
		};
	}, [wheelID, service, replaceChosenActivities]);

	const saveInBackground = useCallback((activityID: string, saveTask: () => Promise<void>): void => {
		backgroundSaveQueueRef.current.addToQueue(activityID, async () => {
			try {
				await saveTask();
			}
			catch (error) {
				setErrorMessage(toErrorMessage(error));
			}
		});
	}, []);

	const findChosenActivity = useCallback((activityID: string): ChosenActivity | undefined => {
		return latestChosenActivitiesRef.current.find((chosenActivity) => chosenActivity.activityID === activityID);
	}, []);

	const restore = useCallback(
		(chosenActivity: ChosenActivity): void => {
			if (findChosenActivity(chosenActivity.activityID)) return;
			replaceChosenActivities([...latestChosenActivitiesRef.current, chosenActivity]);
			saveInBackground(chosenActivity.activityID, () => service.saveChosenActivity(chosenActivity));
		},
		[findChosenActivity, replaceChosenActivities, saveInBackground, service],
	);

	const choose = useCallback(
		(activityID: string): void => {
			restore({ activityID, wheelID, chosenAt: Date.now() });
		},
		[restore, wheelID],
	);

	const remove = useCallback(
		(activityID: string): void => {
			if (!findChosenActivity(activityID)) return;
			replaceChosenActivities(
				latestChosenActivitiesRef.current.filter((chosenActivity) => chosenActivity.activityID !== activityID),
			);
			saveInBackground(activityID, () => service.removeChosenActivity(activityID));
		},
		[findChosenActivity, replaceChosenActivities, saveInBackground, service],
	);

	const chosenActivitiesNewestFirst = useMemo<readonly ChosenActivityWithDetails[]>(() => {
		const activityIDToActivity = new Map(activities.map((activity) => [activity.id, activity]));
		return [...chosenActivities]
			.sort((chosenActivity1, chosenActivity2) => chosenActivity2.chosenAt - chosenActivity1.chosenAt)
			.flatMap((chosenActivity) => {
				const activity = activityIDToActivity.get(chosenActivity.activityID);
				return activity ? [{ chosenActivity, activity }] : [];
			});
	}, [chosenActivities, activities]);

	return useMemo<UseChosenActivitiesApi>(
		() => ({ chosenActivitiesNewestFirst, errorMessage, findChosenActivity, choose, remove, restore }),
		[chosenActivitiesNewestFirst, errorMessage, findChosenActivity, choose, remove, restore],
	);
}
