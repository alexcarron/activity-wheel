/**
 * Orders background saves so that saves for the same activity run one after another in the order they were queued, while saves for different activities run independently.
 */

export type BackgroundSaveTask = () => Promise<void>;

export interface BackgroundSaveQueue {
	addToQueue(activityID: string, saveTask: BackgroundSaveTask): void;
}

export function createBackgroundSaveQueue(): BackgroundSaveQueue {
	const activityIDToPendingSaveTask = new Map<string, Promise<void>>();

	return {
		addToQueue(activityID, saveTask) {
			const previousSaveTask = activityIDToPendingSaveTask.get(activityID) ?? Promise.resolve();
			const nextSaveTask = previousSaveTask.catch(() => {}).then(saveTask);
			activityIDToPendingSaveTask.set(activityID, nextSaveTask);
			void nextSaveTask.finally(() => {
				if (activityIDToPendingSaveTask.get(activityID) === nextSaveTask) {
					activityIDToPendingSaveTask.delete(activityID);
				}
			});
		},
	};
}
