/**
 * App-level composition. Wires wheels, activities, session, wheel canvas, activity list, tag filter, debug panel, and backup controls. 
 */

import './App.css';
import { useMemo, useState } from 'react';
import { useWheels } from './hooks/useWheels';
import { useActivities } from './hooks/useActivities';
import { useAuth } from './hooks/useAuth';
import { useNow } from './hooks/useNow';
import { useSession } from './hooks/useSession';
import { useDebug } from './hooks/useDebug';
import { useTagFilter } from './hooks/useTagFilter';
import { filterActivitiesByTags, isFilterActive } from './domain-logic/tag-filter-logic';
import { AuthButton } from './components/AuthButton';
import { LoadingSpinner } from './components/LoadingSpinner';
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

function App() {
	const auth = useAuth();
	const userId = auth.user?.id ?? null;
	const wheels = useWheels(userId, auth.loading);
	// While wheels are still resolving (including while auth itself is still resolving, since useWheels stays in its loading state through that window) activeWheelId may be a stale or wrong-backend id. Withhold it from useActivities/useTagFilter (both already treat '' as "not resolved yet, keep waiting") so they never fetch against the wrong backend or an invalid id.
	const resolvedWheelId = wheels.loading ? '' : wheels.activeWheelId;
	const activityState = useActivities(resolvedWheelId, userId);
	const debug = useDebug();
	const now = useNow();
	const tagFilter = useTagFilter(resolvedWheelId, userId);
	const [wheelPinned, setWheelPinned] = useState(false);

	const tagService = userId ? createCloudTagService(userId) : localTagService;
	const wheelService = userId ? createCloudWheelService(userId) : localWheelService;

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
				tagFilter.activeTags,
				tagFilter.filterMode,
				tagFilter.untaggedOnly,
			),
		[activityState.activities, tagFilter.activeTags, tagFilter.filterMode, tagFilter.untaggedOnly],
	);

	// Session pool is always the intersection of "passes tag filter" × "not yet spun".
	// useSession is re-initialised when filteredActivities reference changes (on wheel switch).
	const session = useSession(filteredActivities);

	const filterOn = isFilterActive(tagFilter.activeTags, tagFilter.untaggedOnly);

	const handleAddTagToActivity = async (activityId: string, tagName: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === activityId);
		if (!activity) return;
		const newTags = [...new Set([...(activity.tags ?? []), tagName])];
		await activityState.updateTags(activityId, newTags);
		await tagFilter.registerTags([tagName]);
	};

	const handleUpdateTags = async (id: string, tags: string[]): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const removedTags = (activity?.tags ?? []).filter((tag) => !tags.includes(tag));
		await activityState.updateTags(id, tags);
		await tagFilter.registerTags(tags);
		if (removedTags.length > 0) {
			const afterUpdate = activityState.activities.map((candidate) =>
				candidate.id === id ? { ...candidate, tags } : candidate,
			);
			const pruned = await tagService.pruneOrphanTags(wheels.activeWheelId, afterUpdate, removedTags);
			if (pruned.length > 0) tagFilter.pruneTags(pruned);
		}
	};

	const handleDelete = async (id: string): Promise<void> => {
		const activity = activityState.activities.find((candidate) => candidate.id === id);
		const tagsToPrune = activity?.tags ?? [];
		await activityState.remove(id);
		if (tagsToPrune.length > 0) {
			const afterDelete = activityState.activities.filter((candidate) => candidate.id !== id);
			const pruned = await tagService.pruneOrphanTags(wheels.activeWheelId, afterDelete, tagsToPrune);
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
									wheels={wheels.wheels}
									activeWheelId={wheels.activeWheelId}
									onSwitch={wheels.switchWheel}
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
								/>
							</section>

							<TagFilterBar
								allActivities={activityState.activities}
								tagMetadata={tagFilter.tagMetadata}
								activeTags={tagFilter.activeTags}
								untaggedOnly={tagFilter.untaggedOnly}
								filterMode={tagFilter.filterMode}
								onToggleTag={tagFilter.toggleTag}
								onToggleUntagged={tagFilter.toggleUntagged}
								onClearFilter={tagFilter.clearFilter}
								onToggleMode={tagFilter.toggleMode}
							/>

							<section className="app-panel">
								<h2>
									Activities
									{filterOn && (
										<span className="app-panel-filter-badge">
											{filteredActivities.length} shown
										</span>
									)}
								</h2>
								<AddActivity onAdd={activityState.add} />
								<ActivityList
									activities={filterOn ? filteredActivities : activityState.activities}
									showWeights={debug.showWeights}
									showProbabilities={debug.showProbabilities}
									spreadFactor={debug.spreadFactor}
									allTagMetadata={tagFilter.tagMetadata}
									onRename={activityState.rename}
									onFeedback={activityState.applyFeedback}
									onDelete={handleDelete}
									onUpdateTags={handleUpdateTags}
									onSetTagColor={tagFilter.setTagColor}
								/>
							</section>

							<section className="app-panel app-panel-tight">
								<DebugPanel debug={debug} />
								<BackupControls
									exportJson={wheelService.exportFullBackup}
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
						</>
					)}
				</main>
			</WeightProvider>
		</SpinCountProvider>
	);
}

export default App;
