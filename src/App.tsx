/**
 * App-level composition. Wires wheels, activities, session, wheel canvas, activity list, tag filter, debug panel, and backup controls. 
 */

import './App.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWheels } from './hooks/useWheels';
import { useActivities } from './hooks/useActivities';
import { useAuth } from './hooks/useAuth';
import { useNow } from './hooks/useNow';
import { useSession } from './hooks/useSession';
import { useDebug } from './hooks/useDebug';
import { useTagFilter } from './hooks/useTagFilter';
import { useSharedWheelAccess } from './hooks/useSharedWheelAccess';
import type { SharedActivityChange } from './hooks/shared-wheel-realtime';
import { filterActivitiesByTags, isFilterActive } from './domain-logic/tag-filter-logic';
import { AuthButton } from './components/AuthButton';
import { LoadingSpinner } from './components/LoadingSpinner';
import { SharedWheelPasswordGate } from './components/SharedWheelPasswordGate';
import { Toast } from './components/Toast';
import { WheelTabs } from './components/WheelTabs';
import { WheelView } from './components/WheelView';
import { ActivityList } from './components/ActivityList';
import { AddActivity } from './components/AddActivity';
import { DebugPanel } from './components/DebugPanel';
import { BackupControls } from './components/BackupControls';
import { TagFilterBar } from './components/TagFilterBar';
import { WeightProvider } from './context/WeightContext';
import { SpinCountProvider } from './context/SpinCountContext';
import { totalEffective } from './services/activity-service';
import * as localTagService from './services/tag-service';
import * as localWheelService from './services/wheel-service';
import { createCloudTagService } from './services/cloud/tag-service';
import { createCloudWheelService } from './services/cloud/wheel-service';
import { createSharedTagService } from './services/cloud/shared-tag-service';
import { exportSharedWheelBackup } from './services/cloud/shared-wheel-service';
import { getSharedWheelIdFromUrl, removeSharedWheelIdFromUrl } from './utils/url-params';
import { useViewportBreakpoint } from './hooks/useViewportBreakpoint';

function App() {
	const auth = useAuth();
	const userId = auth.user?.id ?? null;
	const wheels = useWheels(userId, auth.loading);
	const resolvedWheelId = wheels.loading ? '' : wheels.activeWheelId;

	const sharedWheelIdFromUrl = useMemo(() => getSharedWheelIdFromUrl(), []);
	const sharedAccess = useSharedWheelAccess(sharedWheelIdFromUrl);
	const [activeSharedWheelId, setActiveSharedWheelId] = useState<string | null>(null);

	const [landedActivityId, setLandedActivityId] = useState<string | null>(null);
	const [activeEditActivityId, setActiveEditActivityId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	
	const { isPhone } = useViewportBreakpoint();
	const [addActivityButtonContainer, setAddActivityButtonContainer] = useState<HTMLDivElement | null>(null);

	// Only fires on hasAccess's rising edge (initial load already-unlocked, or right after entering the password), not on every render, so switching to your own wheel afterward doesn't get immediately overridden back to the shared tab.
	useEffect(() => {
		if (sharedWheelIdFromUrl && sharedAccess.hasAccess) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveSharedWheelId(sharedWheelIdFromUrl);
		}
	}, [sharedWheelIdFromUrl, sharedAccess.hasAccess]);

	// Access is re-verified against whichever auth session is active (see useSharedWheelAccess), so a sign-out, sign-in, or membership change can drop the active shared wheel from unlockedWheels. Fall back to the user's own wheel instead of being stuck on a tab that no longer resolves.
	useEffect(() => {
		if (
			activeSharedWheelId &&
			!sharedAccess.loading &&
			!sharedAccess.unlockedWheels.some((wheel) => wheel.id === activeSharedWheelId)
		) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveSharedWheelId(null);
		}
	}, [activeSharedWheelId, sharedAccess.loading, sharedAccess.unlockedWheels]);

	useEffect(() => {
		if (sharedAccess.wasSharedWheelNotFound) {
			removeSharedWheelIdFromUrl();
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setToastMessage('No shared wheel exists with that link.');
		}
	}, [sharedAccess.wasSharedWheelNotFound]);

	const combinedWheelId = activeSharedWheelId ?? resolvedWheelId;

	const handleEditingChange = useCallback((activityId: string, isEditing: boolean): void => {
		setActiveEditActivityId((current) => {
			if (isEditing) return activityId;
			return current === activityId ? null : current;
		});
	}, []);

	const handleRemoteActivityChange = useCallback(
		(change: SharedActivityChange): void => {
			const changedActivityId = change.type === 'delete' ? change.activityId : change.activity.id;
			if (changedActivityId === landedActivityId || changedActivityId === activeEditActivityId) {
				setToastMessage('Wheel updated by another user.');
			}
		},
		[landedActivityId, activeEditActivityId],
	);

	const activityState = useActivities(combinedWheelId, userId, activeSharedWheelId, handleRemoteActivityChange);
	const debug = useDebug();
	const now = useNow(activityState.activities);
	const tagFilter = useTagFilter(combinedWheelId, userId, activeSharedWheelId);
	const [wheelPinned, setWheelPinned] = useState(false);

	const tagService = userId ? createCloudTagService(userId) : localTagService;
	const wheelService = userId ? createCloudWheelService(userId) : localWheelService;
	// Tag-pruning must target whichever wheel is actually active, unlike `tagService`/`wheelService` above.
	const activeTagService = activeSharedWheelId ? createSharedTagService() : tagService;
	const activeWheelIdForTagOps = activeSharedWheelId ?? wheels.activeWheelId;

	const tabWheels = useMemo(
		() => [...wheels.wheels, ...sharedAccess.unlockedWheels],
		[wheels.wheels, sharedAccess.unlockedWheels],
	);
	const combinedActiveWheelId = activeSharedWheelId ?? wheels.activeWheelId;

	const handleSwitchTab = useCallback(
		(id: string): void => {
			const isShared = sharedAccess.unlockedWheels.some((wheel) => wheel.id === id);
			if (isShared) {
				setActiveSharedWheelId(id);
			}
			else {
				setActiveSharedWheelId(null);
				wheels.switchWheel(id);
			}
		},
		[sharedAccess.unlockedWheels, wheels],
	);

	const globalWeightContext = useMemo(
		() => ({
			numTotalActivities: activityState.activities.length,
			totalEffectiveWeight: totalEffective(activityState.activities, now),
		}),
		[activityState.activities, now],
	);

	const filteredActivities = useMemo(
		() =>
			filterActivitiesByTags(
				activityState.activities,
				tagFilter.activeTagIds,
				tagFilter.filterMode,
				tagFilter.untaggedOnly,
			),
		[activityState.activities, tagFilter.activeTagIds, tagFilter.filterMode, tagFilter.untaggedOnly],
	);

	// Session pool is always the intersection of "passes tag filter" × "not yet spun".
	// useSession is re-initialised when filteredActivities reference changes (on wheel switch).
	const session = useSession(filteredActivities);

	const filterOn = isFilterActive(tagFilter.activeTagIds, tagFilter.untaggedOnly);

	const handleAddTagToActivity = async (activityId: string, tagName: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === activityId);
		if (!activity) return;
		const [meta] = await tagFilter.registerTags([tagName]);
		const newTagIds = [...new Set([...(activity.tagIds ?? []), meta.id])];
		await activityState.updateTags(activityId, newTagIds);
	};

	const handleUpdateTags = async (id: string, tagIds: string[]): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const removedTagIds = (activity?.tagIds ?? []).filter((tagId) => !tagIds.includes(tagId));
		await activityState.updateTags(id, tagIds);
		if (removedTagIds.length > 0) {
			const afterUpdate = activityState.activities.map((candidate) =>
				candidate.id === id ? { ...candidate, tagIds } : candidate,
			);
			const pruned = await activeTagService.pruneOrphanTags(activeWheelIdForTagOps, afterUpdate, removedTagIds);
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
					activity.tagIds.filter((tagId) => tagId !== id),
				),
			),
		);
		await activeTagService.deleteTagMetadata(activeWheelIdForTagOps, id);
		tagFilter.pruneTags([id]);
	};

	const handleBatchAddTagByName = async (name: string, activityIds: readonly string[]): Promise<void> => {
		const [meta] = await tagFilter.registerTags([name]);
		const updates = activityState.activities
			.filter((activity) => activityIds.includes(activity.id) && !(activity.tagIds ?? []).includes(meta.id))
			.map((activity) => activityState.updateTags(activity.id, [...(activity.tagIds ?? []), meta.id]));
		await Promise.all(updates);
	};

	const handleDelete = async (id: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const tagIdsToPrune = activity?.tagIds ?? [];
		await activityState.remove(id);
		if (tagIdsToPrune.length > 0) {
			const afterDelete = activityState.activities.filter((candidate) => candidate.id !== id);
			const pruned = await activeTagService.pruneOrphanTags(activeWheelIdForTagOps, afterDelete, tagIdsToPrune);
			if (pruned.length > 0) tagFilter.pruneTags(pruned);
		}
	};

	const handleCreateWheel = async (
		name: string,
		fromWheelId: string | null,
		resetWeights: boolean,
	): Promise<void> => {
		let newWheel;
		if (fromWheelId) {
			newWheel = await wheels.copyWheel(fromWheelId, name, resetWeights);
		}
		else {
			newWheel = await wheels.createWheel(name);
		}
		wheels.switchWheel(newWheel.id);
	};

	if (sharedWheelIdFromUrl && sharedAccess.loading) {
		return (
			<main className="app">
				<div className="app-sync-indicator" role="status">
					<LoadingSpinner />
					Checking shared wheel access…
				</div>
			</main>
		);
	}
	if (sharedWheelIdFromUrl && !sharedAccess.hasAccess && !sharedAccess.wasSharedWheelNotFound) {
		return (
			<SharedWheelPasswordGate
				wheelName={sharedAccess.wheelName}
				unlocking={sharedAccess.unlocking}
				errorMessage={sharedAccess.errorMessage}
				onUnlock={sharedAccess.unlock}
			/>
		);
	}

	// Full-app loading gate: true only while auth is resolving or while wheels is resolving which backend to use (initial load, sign-in, sign-out). It is NOT true for a same-backend wheel switch, since switchWheel doesn't touch wheels.loading. This intentionally hides every other component, including the sign-in button, so the user never sees a flash of the wrong backend's data (local vs. cloud) or an error caused by querying before the correct wheel is known.
	const isBackendLoading = auth.loading || wheels.loading;
	// Lighter-weight sync indicator shown without hiding the rest of the UI, e.g. while activities are refetching for a newly-switched wheel.
	const isSyncing = isBackendLoading || activityState.isLoading;

	return (
		<SpinCountProvider>
			<WeightProvider value={globalWeightContext}>
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
									activeWheelId={combinedActiveWheelId}
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
									wheelPinned={wheelPinned}
									onToggleWheelPinned={() => setWheelPinned((wasPinned) => !wasPinned)}
									onClearTagFilter={tagFilter.clearFilter}
									onFeedback={async (id, action) => {
										await activityState.applyFeedback(id, action);
										session.exclude(id);
									}}
									onRename={activityState.rename}
									onAddTagToActivity={handleAddTagToActivity}
									onLandedActivityIdChange={setLandedActivityId}
								/>
							</section>

							<TagFilterBar
								allActivities={activityState.activities}
								tagMetadata={tagFilter.tagMetadata}
								activeTagIds={tagFilter.activeTagIds}
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
									allActivities={activityState.activities}
									showWeights={debug.showWeights}
									showProbabilities={debug.showProbabilities}
									spreadFactor={debug.spreadFactor}
									allTagMetadata={tagFilter.tagMetadata}
									onRename={activityState.rename}
									onFeedback={activityState.applyFeedback}
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
									readOnly={!!activeSharedWheelId}
									exportJson={
										activeSharedWheelId
											? () => exportSharedWheelBackup(activeSharedWheelId)
											: wheelService.exportFullBackup
									}
									importJson={async (json) => {
										const firstWheelId = await wheelService.importFullBackup(json);
										await wheels.reloadWheels();
										wheels.switchWheel(firstWheelId);
										// If the active wheel ID didn't change, force-reload activities + tags.
										if (firstWheelId === wheels.activeWheelId) {
											await activityState.reload();
											tagFilter.clearFilter();
											await tagFilter.reloadMetadata();
										}
									}}
									clearWheel={async () => {
										await activityState.clearEverything();
										await tagService.clearWheelTagMetadata(wheels.activeWheelId);
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
									{userId
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
			</WeightProvider>
		</SpinCountProvider>
	);
}

export default App;
