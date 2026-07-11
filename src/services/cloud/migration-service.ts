/**
 * One-time import of the signed-out local (IndexedDB) wheels into a signed-in
 * user's Supabase account. Local data is left untouched. This is a copy, not a move,
 * so the user can keep using local mode on this browser if they sign out again.
 */

import * as localWheelService from '../wheel-service';
import { createCloudWheelService } from './wheel-service';
import { createCloudActivityService } from './activity-service';

export async function migrateLocalDataToCloud(userId: string): Promise<number> {
	const cloudWheelService = createCloudWheelService(userId);
	const cloudActivityService = createCloudActivityService(userId);

	// importFullBackup replaces ALL existing wheels for the target account, so this
	// must only ever run against an account with no real data. useWheels auto-creates
	// a blank "My Wheel" the first time a signed-in account has zero wheels, so a
	// freshly signed-in user will always have exactly that one empty wheel by the
	// time they reach this button. Treat that case as "empty" too, and only refuse
	// if any existing cloud wheel actually has activities in it.
	const existingCloudWheels = await cloudWheelService.listWheels();
	const existingActivityCounts = await Promise.all(
		existingCloudWheels.map((wheel) => cloudActivityService.listActivities(wheel.id)),
	);
	const hasRealCloudData = existingActivityCounts.some((activities) => activities.length > 0);
	if (hasRealCloudData) {
		throw new Error('This account already has saved wheels. Import would overwrite them.');
	}

	const localWheels = await localWheelService.listWheels();
	if (localWheels.length === 0) return 0;

	const backupJson = await localWheelService.exportFullBackup();
	await cloudWheelService.importFullBackup(backupJson);
	return localWheels.length;
}
