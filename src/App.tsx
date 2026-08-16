/**
 * App-level composition. Wires wheels, activities, session, wheel canvas, activity list, tag filter, debug panel, and backup controls. 
 */

import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWheels } from './hooks/useWheels';
import { useActivities } from './hooks/useActivities';
import { useAuth } from './hooks/useAuth';
import { useSession } from './hooks/useSession';
import { useDebug } from './hooks/useDebug';
import { useLockedActualWeights } from './hooks/useLockedActualWeights';
import { useTagFilter } from './hooks/useTagFilter';
import { useSharedWheelAccess } from './hooks/useSharedWheelAccess';
import type { SharedActivityChange } from './hooks/shared-wheel-realtime';
import { filterActivitiesByTags, isFilterActive } from './domain-logic/tag-filter-logic';
import { AuthButton } from './components/AuthButton';
import { LoadingSpinner } from './components/reusable/LoadingSpinner';
import { SharedWheelPasswordGate } from './components/SharedWheelPasswordGate';
import { Toast } from './components/reusable/Toast';
import { WheelTabs } from './components/panels/wheel/WheelTabs';
import { WheelView } from './components/panels/wheel/WheelView';
import { ActivityList } from './components/panels/activity-list/ActivityList';
import { AddActivity } from './components/panels/activity-list/AddActivity';
import { DebugPanel } from './components/panels/debug/DebugPanel';
import { BackupControls } from './components/panels/backup-restore/BackupControls';
import { TagFilterBar } from './components/panels/tag-filter/TagFilterBar';
import { SpinCountProvider } from './context/SpinCountContext';
import * as localTagService from './services/tag-service';
import * as localWheelService from './services/wheel-service';
import { createCloudTagService } from './services/cloud/tag-service';
import { createCloudWheelService } from './services/cloud/wheel-service';
import { createSharedTagService } from './services/cloud/shared-tag-service';
import { exportSharedWheelBackup } from './services/cloud/shared-wheel-service';
import { getSharedWheelIDFromUrl, removeSharedWheelIDFromUrl } from './utils/url-params';
import { useViewportBreakpoint } from './hooks/useViewportBreakpoint';

function App() {
	const auth = useAuth();
	const userID = auth.user?.id ?? null;
	const wheels = useWheels(userID, auth.loading);
	const resolvedWheelID = wheels.loading ? '' : wheels.activeWheelID;

	const sharedWheelIDFromUrl = useMemo(() => getSharedWheelIDFromUrl(), []);
	const sharedAccess = useSharedWheelAccess(sharedWheelIDFromUrl);
	const [activeSharedWheelID, setActiveSharedWheelID] = useState<string | null>(null);

	const [landedActivityID, setLandedActivityID] = useState<string | null>(null);
	const [activeEditActivityID, setActiveEditActivityID] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	
	const { isPhone } = useViewportBreakpoint();
	const [addActivityButtonContainer, setAddActivityButtonContainer] = useState<HTMLDivElement | null>(null);

	// Only fires on hasAccess's rising edge (initial load already-unlocked, or right after entering the password), not on every render, so switching to your own wheel afterward doesn't get immediately overridden back to the shared tab.
	useEffect(() => {
		if (sharedWheelIDFromUrl && sharedAccess.hasAccess) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveSharedWheelID(sharedWheelIDFromUrl);
		}
	}, [sharedWheelIDFromUrl, sharedAccess.hasAccess]);

	// Access is re-verified against whichever auth session is active (see useSharedWheelAccess), so a sign-out, sign-in, or membership change can drop the active shared wheel from unlockedWheels. Fall back to the user's own wheel instead of being stuck on a tab that no longer resolves.
	useEffect(() => {
		if (
			activeSharedWheelID &&
			!sharedAccess.loading &&
			!sharedAccess.unlockedWheels.some((wheel) => wheel.id === activeSharedWheelID)
		) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveSharedWheelID(null);
		}
	}, [activeSharedWheelID, sharedAccess.loading, sharedAccess.unlockedWheels]);

	useEffect(() => {
		if (sharedAccess.wasSharedWheelNotFound) {
			removeSharedWheelIDFromUrl();
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setToastMessage('No shared wheel exists with that link.');
		}
	}, [sharedAccess.wasSharedWheelNotFound]);

	const combinedWheelID = activeSharedWheelID ?? resolvedWheelID;

	const handleEditingChange = useCallback((activityID: string, isEditing: boolean): void => {
		setActiveEditActivityID((current) => {
			if (isEditing) return activityID;
			return current === activityID ? null : current;
		});
	}, []);

	const handleRemoteActivityChange = useCallback(
		(change: SharedActivityChange): void => {
			const changedActivityID = change.type === 'delete' ? change.activityID : change.activity.id;
			if (changedActivityID === landedActivityID || changedActivityID === activeEditActivityID) {
				setToastMessage('Wheel updated by another user.');
			}
		},
		[landedActivityID, activeEditActivityID],
	);

	const activityState = useActivities(combinedWheelID, userID, activeSharedWheelID, handleRemoteActivityChange);
	const debug = useDebug();
	const tagFilter = useTagFilter(combinedWheelID, userID, activeSharedWheelID);
	const lockedActualWeights = useLockedActualWeights({ activities: activityState.activities, spreadFactor: debug.spreadFactor });
	const [wheelPinned, setWheelPinned] = useState(false);

	const tagService = userID ? createCloudTagService(userID) : localTagService;
	const wheelService = userID ? createCloudWheelService(userID) : localWheelService;
	// Tag-pruning must target whichever wheel is actually active, unlike `tagService`/`wheelService` above.
	const activeTagService = activeSharedWheelID ? createSharedTagService() : tagService;
	const activeWheelIDForTagOps = activeSharedWheelID ?? wheels.activeWheelID;

	const tabWheels = useMemo(
		() => [...wheels.wheels, ...sharedAccess.unlockedWheels],
		[wheels.wheels, sharedAccess.unlockedWheels],
	);
	const combinedActiveWheelID = activeSharedWheelID ?? wheels.activeWheelID;

	const handleSwitchTab = useCallback(
		(id: string): void => {
			const isShared = sharedAccess.unlockedWheels.some((wheel) => wheel.id === id);
			if (isShared) {
				setActiveSharedWheelID(id);
			}
			else {
				setActiveSharedWheelID(null);
				wheels.switchWheel(id);
			}
		},
		[sharedAccess.unlockedWheels, wheels],
	);

	const filteredActivities = useMemo(
		() =>
			filterActivitiesByTags(
				activityState.activities,
				tagFilter.activeTagIDs,
				tagFilter.filterMode,
				tagFilter.untaggedOnly,
			),
		[activityState.activities, tagFilter.activeTagIDs, tagFilter.filterMode, tagFilter.untaggedOnly],
	);

	const session = useSession(filteredActivities);

	const filterOn = isFilterActive(tagFilter.activeTagIDs, tagFilter.untaggedOnly);

	const handleAddTagToActivity = async (activityID: string, tagName: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === activityID);
		if (!activity) return;
		const [meta] = await tagFilter.registerTags([tagName]);
		const newTagIDs = [...new Set([...(activity.tagIds ?? []), meta.id])];
		await activityState.updateTags(activityID, newTagIDs);
	};

	const handleUpdateTags = async (id: string, tagIds: string[]): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const removedTagIDs = (activity?.tagIds ?? []).filter((tagID) => !tagIds.includes(tagID));
		await activityState.updateTags(id, tagIds);
		if (removedTagIDs.length > 0) {
			const afterUpdate = activityState.activities.map((candidate) =>
				candidate.id === id ? { ...candidate, tagIds } : candidate,
			);
			const pruned = await activeTagService.pruneOrphanTags(activeWheelIDForTagOps, afterUpdate, removedTagIDs);
			if (pruned.length > 0) tagFilter.pruneTags(pruned);
		}
	};

	const handleRenameTag = async (id: string, newName: string): Promise<void> => {
		await tagFilter.renameTag(id, newName);
	};

	const handleDeleteTag = async (id: string): Promise<void> => {
		const affectedActivities = activityState.activities.filter((activity) =>
			(activity.tagIds ?? []).includes(id),
		);
		await Promise.all(
			affectedActivities.map((activity) =>
				activityState.updateTags(
					activity.id,
					activity.tagIds.filter((tagID) => tagID !== id),
				),
			),
		);
		await activeTagService.deleteTagMetadata(activeWheelIDForTagOps, id);
		tagFilter.pruneTags([id]);
	};

	const handleBatchAddTagByName = async (name: string, activityIDs: readonly string[]): Promise<void> => {
		const [meta] = await tagFilter.registerTags([name]);
		const updates = activityState.activities
			.filter((activity) => activityIDs.includes(activity.id) && !(activity.tagIds ?? []).includes(meta.id))
			.map((activity) => activityState.updateTags(activity.id, [...(activity.tagIds ?? []), meta.id]));
		await Promise.all(updates);
	};

	const handleDelete = async (id: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const tagIDsToPrune = activity?.tagIds ?? [];
		await activityState.remove(id);
		if (tagIDsToPrune.length > 0) {
			const afterDelete = activityState.activities.filter((candidate) => candidate.id !== id);
			const pruned = await activeTagService.pruneOrphanTags(activeWheelIDForTagOps, afterDelete, tagIDsToPrune);
			if (pruned.length > 0) tagFilter.pruneTags(pruned);
		}
	};

	const handleCreateWheel = async (
		name: string,
		fromWheelID: string | null,
		resetWeights: boolean,
	): Promise<void> => {
		let newWheel;
		if (fromWheelID) {
			newWheel = await wheels.copyWheel(fromWheelID, name, resetWeights);
		}
		else {
			newWheel = await wheels.createWheel(name);
		}
		wheels.switchWheel(newWheel.id);
	};

	if (sharedWheelIDFromUrl && sharedAccess.loading) {
		return (
			<main className="app">
				<div className="app-sync-indicator" role="status">
					<LoadingSpinner />
					Checking shared wheel access…
				</div>
			</main>
		);
	}
	if (sharedWheelIDFromUrl && !sharedAccess.hasAccess && !sharedAccess.wasSharedWheelNotFound) {
		return (
			<SharedWheelPasswordGate
				wheelName={sharedAccess.wheelName}
				unlocking={sharedAccess.unlocking}
				errorMessage={sharedAccess.errorMessage}
				onUnlock={sharedAccess.unlock}
			/>
		);
	}

	/**
	 * True if auth or wheels are resolving
	 */
	const isBackendLoading = auth.loading || wheels.loading;
	const isSyncing = isBackendLoading || activityState.isLoading;

	return (
		<SpinCountProvider>
			<main className="app">
				{isBackendLoading ? (
					<div className="app-sync-indicator" role="status">
						<LoadingSpinner />
						Loading your data…
					</div>
				) : (
					<>
						{isSyncing && (
							<div className="app-sync-indicator" role="status">
								<LoadingSpinner />
								Loading your data…
							</div>
						)}

						{(wheels.errorMessage || activityState.errorMessage) && (
							<div className="app-error" role="alert">
								{wheels.errorMessage ?? activityState.errorMessage}
							</div>
						)}

						<section className={`wheel-header${wheelPinned ? ' is-pinned' : ''}`}>
							<div className="wheel-header-auth-row">
								<AuthButton onLocalDataImported={() => void wheels.reloadWheels()} />
							</div>

							<WheelTabs
								wheels={tabWheels}
								activeWheelID={combinedActiveWheelID}
								onSwitch={handleSwitchTab}
								onCreate={handleCreateWheel}
								onRename={wheels.renameWheel}
								onDelete={wheels.deleteWheel}
							/>

							<WheelView
								activities={filteredActivities}
								session={session}
								rngSeed={debug.rngSeed}
								spreadFactor={debug.spreadFactor}
								tagFilterActive={filterOn}
								allTagMetadata={tagFilter.tagMetadata}
								isWheelPinned={wheelPinned}
								activityIDToLockedActualWeight={lockedActualWeights.lockedActualWeightByActivityID}
								shouldSizeWheelByActualCurrentWeights={debug.sizeWheelByActualCurrentWeights}
								onSpun={lockedActualWeights.reroll}
								onToggleWheelPinned={() => setWheelPinned((wasPinned) => !wasPinned)}
								onClearTagFilter={tagFilter.clearFilter}
								onFeedback={async (id, action) => {
									await activityState.applyFeedback(id, action);
									session.excludeActivity(id);
									lockedActualWeights.reroll();
								}}
								onRename={activityState.rename}
								onAddTagToActivity={handleAddTagToActivity}
								onLandedActivityIDChange={setLandedActivityID}
							/>
						</section>

						<TagFilterBar
							allActivities={activityState.activities}
							tagMetadata={tagFilter.tagMetadata}
							activeTagIDs={tagFilter.activeTagIDs}
							untaggedOnly={tagFilter.untaggedOnly}
							filterMode={tagFilter.filterMode}
							onToggleTag={tagFilter.toggleTag}
							onToggleUntagged={tagFilter.toggleUntagged}
							onClearFilter={tagFilter.clearFilter}
							onToggleMode={tagFilter.toggleMode}
							onSetTagColor={tagFilter.setTagColor}
							onRenameTag={handleRenameTag}
							onDeleteTag={handleDeleteTag}
						/>

						<section className="app-panel">
							<div className='app-panel-title'>
								<h2>
									Activities
									{filterOn && (
										<span className="app-panel-filter-badge">
											{filteredActivities.length} shown
										</span>
									)}
								</h2>
								{isPhone && <div ref={setAddActivityButtonContainer} />}
							</div>
							<AddActivity onAdd={activityState.add} mobileButtonContainer={addActivityButtonContainer} />
							<ActivityList
								activities={filterOn ? filteredActivities : activityState.activities}
								debugValuePillKeyToIsVisible={debug.debugValuePillKeyToIsVisible}
								spreadFactor={debug.spreadFactor}
								allTagMetadata={tagFilter.tagMetadata}
								lockedActualWeightByActivityID={lockedActualWeights.lockedActualWeightByActivityID}
								lockedActualProbabilityByActivityID={lockedActualWeights.lockedActualProbabilityByActivityID}
								onRename={activityState.rename}
								onFeedback={async (id, action) => {
									await activityState.applyFeedback(id, action);
									lockedActualWeights.reroll();
								}}
								onDelete={handleDelete}
								onUpdateTags={handleUpdateTags}
								onAddTag={handleAddTagToActivity}
								onSetTagColor={tagFilter.setTagColor}
								onRenameTag={handleRenameTag}
								onDeleteTag={handleDeleteTag}
								onAddTagByName={handleBatchAddTagByName}
								onEditingChange={handleEditingChange}
							/>
						</section>

						<section className="app-panel app-panel-tight">
							<DebugPanel debug={debug} />
							<BackupControls
								readOnly={!!activeSharedWheelID}
								exportJson={
									activeSharedWheelID
										? () => exportSharedWheelBackup(activeSharedWheelID)
										: wheelService.exportFullBackup
								}
								importJson={async (json) => {
									const firstWheelID = await wheelService.importFullBackup(json);
									await wheels.reloadWheels();
									wheels.switchWheel(firstWheelID);
									// If the active wheel ID didn't change, force-reload activities + tags.
									if (firstWheelID === wheels.activeWheelID) {
										await activityState.reload();
										tagFilter.clearFilter();
										await tagFilter.reloadMetadata();
									}
								}}
								clearWheel={async () => {
									await activityState.clearEverything();
									await tagService.clearWheelTagMetadata(wheels.activeWheelID);
									tagFilter.clearFilter();
									await tagFilter.reloadMetadata();
								}}
								clearAllWheels={async () => {
									const newWheel = await wheelService.resetToBlankWheel();
									await wheels.reloadWheels();
									wheels.switchWheel(newWheel.id);
								}}
							/>
						</section>

						<footer className="app-footer">
							<p>
								{userID
									? 'Signed in. Your wheels are saved privately to your account.'
									: "Data lives only in this browser. Sign in to save it to your account, or use Backup & restore to keep a copy."}
							</p>
						</footer>

						{toastMessage && (
							<Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
						)}
					</>
				)}
			</main>
		</SpinCountProvider>
	);
}

export default App;
