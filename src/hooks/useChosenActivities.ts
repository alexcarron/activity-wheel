/** The current user's chosen activities on the active wheel. Every change shows instantly and saves in the background. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, ChosenActivity, RatingFeedbackAction } from '../domain-logic/types';
import * as localChosenActivityService from '../services/chosen-activity-service';
import {
	createCloudChosenActivityService,
	createSharedChosenActivityService,
	type ChosenActivityService,
} from '../services/cloud/chosen-activity-service';
import { createBackgroundSaveQueue } from '../services/background-save-queue';
import { toErrorMessage } from '../utils/error-message';

export type ChosenActivityClearedBy = RatingFeedbackAction | 'dismissal';

interface ClearedChosenActivity {
	readonly chosenActivity: ChosenActivity;
	readonly clearedBy: ChosenActivityClearedBy;
	readonly isFadingOut: boolean;
}

export interface ChosenActivityWithDetails {
	readonly chosenActivity: ChosenActivity;
	readonly activity: Activity;
	readonly clearedState?: {
		readonly clearedBy: ChosenActivityClearedBy;
		readonly isFadingOut: boolean;
	};
}

interface UseChosenActivitiesApi {
	readonly chosenActivitiesNewestFirst: readonly ChosenActivityWithDetails[];
	readonly errorMessage: string | null;
	findChosenActivity(activityID: string): ChosenActivity | undefined;
	choose(activityID: string): void;
	clear(parameters: { activityID: string; clearedBy: ChosenActivityClearedBy }): void;
	restore(chosenActivity: ChosenActivity): void;
	startFadingOutClearedChosenActivity(activityID: string): void;
	forgetClearedChosenActivity(activityID: string): void;
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
	const [clearedChosenActivities, setClearedChosenActivities] = useState<readonly ClearedChosenActivity[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const latestChosenActivitiesRef = useRef(chosenActivities);
	const backgroundSaveQueueRef = useRef(createBackgroundSaveQueue());
	const queuedSaveCountRef = useRef(0);

	const replaceChosenActivities = useCallback((nextChosenActivities: readonly ChosenActivity[]): void => {
		latestChosenActivitiesRef.current = nextChosenActivities;
		setChosenActivities(nextChosenActivities);
	}, []);

	useEffect(() => {
		let isCurrentLoad = true;
		void (async () => {
			try {
				let loadedChosenActivities: ChosenActivity[] = [];
				let wasSaveQueuedDuringRead = true;
				while (wasSaveQueuedDuringRead) {
					await backgroundSaveQueueRef.current.waitUntilAllSavesFinish();
					if (!isCurrentLoad) return;
					const queuedSaveCountBeforeRead = queuedSaveCountRef.current;
					loadedChosenActivities = wheelID ? await service.listChosenActivitiesOfWheel(wheelID) : [];
					if (!isCurrentLoad) return;
					wasSaveQueuedDuringRead = queuedSaveCountRef.current !== queuedSaveCountBeforeRead;
				}
				replaceChosenActivities(loadedChosenActivities);
				setClearedChosenActivities((current) =>
					current.filter((clearedChosenActivity) => clearedChosenActivity.chosenActivity.wheelID === wheelID),
				);
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
		queuedSaveCountRef.current += 1;
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

	const forgetClearedChosenActivity = useCallback((activityID: string): void => {
		setClearedChosenActivities((current) =>
			current.filter((clearedChosenActivity) => clearedChosenActivity.chosenActivity.activityID !== activityID),
		);
	}, []);

	const startFadingOutClearedChosenActivity = useCallback((activityID: string): void => {
		setClearedChosenActivities((current) =>
			current.map((clearedChosenActivity) => {
				if (clearedChosenActivity.chosenActivity.activityID !== activityID) return clearedChosenActivity;
				return { ...clearedChosenActivity, isFadingOut: true };
			}),
		);
	}, []);

	const restore = useCallback(
		(chosenActivity: ChosenActivity): void => {
			forgetClearedChosenActivity(chosenActivity.activityID);
			if (findChosenActivity(chosenActivity.activityID)) return;
			replaceChosenActivities([...latestChosenActivitiesRef.current, chosenActivity]);
			saveInBackground(chosenActivity.activityID, () => service.saveChosenActivity(chosenActivity));
		},
		[findChosenActivity, forgetClearedChosenActivity, replaceChosenActivities, saveInBackground, service],
	);

	const choose = useCallback(
		(activityID: string): void => {
			restore({ activityID, wheelID, chosenAt: Date.now() });
		},
		[restore, wheelID],
	);

	const clear = useCallback(
		({ activityID, clearedBy }: { activityID: string; clearedBy: ChosenActivityClearedBy }): void => {
			const chosenActivity = findChosenActivity(activityID);
			if (!chosenActivity) return;
			replaceChosenActivities(
				latestChosenActivitiesRef.current.filter((candidate) => candidate.activityID !== activityID),
			);
			setClearedChosenActivities((current) => [
				...current.filter((clearedChosenActivity) => clearedChosenActivity.chosenActivity.activityID !== activityID),
				{
					chosenActivity,
					clearedBy,
					isFadingOut: false,
				},
			]);
			saveInBackground(activityID, () => service.removeChosenActivity(activityID));
		},
		[findChosenActivity, replaceChosenActivities, saveInBackground, service],
	);

	const chosenActivitiesNewestFirst = useMemo<readonly ChosenActivityWithDetails[]>(() => {
		const activityIDToActivity = new Map(activities.map((activity) => [activity.id, activity]));
		const waitingChosenActivities = chosenActivities.flatMap((chosenActivity) => {
			const activity = activityIDToActivity.get(chosenActivity.activityID);
			return activity ? [{ chosenActivity, activity }] : [];
		});
		const clearedChosenActivitiesOfWheel = clearedChosenActivities
			.filter(({ chosenActivity }) => chosenActivity.wheelID === wheelID)
			.flatMap(({ chosenActivity, clearedBy, isFadingOut }) => {
				const activity = activityIDToActivity.get(chosenActivity.activityID);
				return activity ? [{ chosenActivity, activity, clearedState: { clearedBy, isFadingOut } }] : [];
			});
		return [...waitingChosenActivities, ...clearedChosenActivitiesOfWheel].sort(
			(details1, details2) => details2.chosenActivity.chosenAt - details1.chosenActivity.chosenAt,
		);
	}, [chosenActivities, clearedChosenActivities, activities, wheelID]);

	return useMemo<UseChosenActivitiesApi>(
		() => ({
			chosenActivitiesNewestFirst,
			errorMessage,
			findChosenActivity,
			choose,
			clear,
			restore,
			startFadingOutClearedChosenActivity,
			forgetClearedChosenActivity,
		}),
		[
			chosenActivitiesNewestFirst,
			errorMessage,
			findChosenActivity,
			choose,
			clear,
			restore,
			startFadingOutClearedChosenActivity,
			forgetClearedChosenActivity,
		],
	);
}
