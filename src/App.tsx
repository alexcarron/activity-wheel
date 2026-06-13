/**
 * App-level composition. Wires wheels, activities, session, wheel canvas,
 * activity list, tag filter, debug panel, and backup controls.
 */

import './App.css';
import { useMemo } from 'react';
import { useWheels } from './hooks/useWheels';
import { useActivities } from './hooks/useActivities';
import { useNow } from './hooks/useNow';
import { useSession } from './hooks/useSession';
import { useDebug } from './hooks/useDebug';
import { useTagFilter } from './hooks/useTagFilter';
import { filterActivitiesByTags, isFilterActive } from './domain-logic/tag-filter-logic';
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
import {
  clearWheelTagMetadata,
  pruneOrphanTags,
} from './services/tag-service';
import {
  exportFullBackup,
  importFullBackup,
  resetToBlankWheel,
} from './services/wheel-service';

function App() {
  const wheels = useWheels();
  const acts = useActivities(wheels.activeWheelId);
  const debug = useDebug();
  const now = useNow();
  const tagFilter = useTagFilter(wheels.activeWheelId);

  const globalWeightContext = useMemo(
    () => ({
      numTotalActivities: acts.activities.length,
      totalEffectiveWeight: totalEffective(acts.activities, now),
    }),
    [acts.activities, now],
  );

  const filteredActivities = useMemo(
    () =>
      filterActivitiesByTags(
        acts.activities,
        tagFilter.activeTags,
        tagFilter.filterMode,
        tagFilter.untaggedOnly,
      ),
    [acts.activities, tagFilter.activeTags, tagFilter.filterMode, tagFilter.untaggedOnly],
  );

  // Session pool is always the intersection of "passes tag filter" × "not yet spun".
  // useSession is re-initialised when filteredActivities reference changes (on wheel switch).
  const session = useSession(filteredActivities);

  const filterOn = isFilterActive(tagFilter.activeTags, tagFilter.untaggedOnly);

  const handleAddTagToActivity = async (activityId: string, tagName: string): Promise<void> => {
    const activity = acts.activities.find((a) => a.id === activityId);
    if (!activity) return;
    const newTags = [...new Set([...(activity.tags ?? []), tagName])];
    await acts.updateTags(activityId, newTags);
    await tagFilter.registerTags([tagName]);
  };

  const handleUpdateTags = async (id: string, tags: string[]): Promise<void> => {
    const activity = acts.activities.find((a) => a.id === id);
    const removedTags = (activity?.tags ?? []).filter((t) => !tags.includes(t));
    await acts.updateTags(id, tags);
    await tagFilter.registerTags(tags);
    if (removedTags.length > 0) {
      const afterUpdate = acts.activities.map((a) => (a.id === id ? { ...a, tags } : a));
      const pruned = await pruneOrphanTags(wheels.activeWheelId, afterUpdate, removedTags);
      if (pruned.length > 0) tagFilter.pruneTags(pruned);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    const activity = acts.activities.find((a) => a.id === id);
    const tagsToPrune = activity?.tags ?? [];
    await acts.remove(id);
    if (tagsToPrune.length > 0) {
      const afterDelete = acts.activities.filter((a) => a.id !== id);
      const pruned = await pruneOrphanTags(wheels.activeWheelId, afterDelete, tagsToPrune);
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
    } else {
      newWheel = await wheels.createWheel(name);
    }
    wheels.switchWheel(newWheel.id);
  };

  return (
    <SpinCountProvider>
      <WeightProvider value={globalWeightContext}>
        <main className="app">
          {/* Wheel tab bar — always visible at the top */}
					
          {acts.error && (
            <div className="app-error" role="alert">
              {acts.error}
            </div>
          )}

          {acts.loading ? (
            <div className="app-loading">Loading your activities…</div>
          ) : (
            <>
							<section className="wheel-header">
								{!wheels.loading && (
									<WheelTabs
										wheels={wheels.wheels}
										activeWheelId={wheels.activeWheelId}
										onSwitch={wheels.switchWheel}
										onCreate={handleCreateWheel}
										onRename={wheels.renameWheel}
										onDelete={wheels.deleteWheel}
									/>
								)}

								<WheelView
									activities={filteredActivities}
									session={session}
									rngSeed={debug.rngSeed}
									tagFilterActive={filterOn}
									allTagMetadata={tagFilter.tagMetadata}
									onClearTagFilter={tagFilter.clearFilter}
									onFeedback={async (id, action) => {
										await acts.feedback(id, action);
										session.exclude(id);
									}}
									onRename={acts.rename}
									onAddTagToActivity={handleAddTagToActivity}
								/>
							</section>

              <TagFilterBar
                allActivities={acts.activities}
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
                <AddActivity onAdd={acts.add} />
                <ActivityList
                  activities={filterOn ? filteredActivities : acts.activities}
                  showWeights={debug.showWeights}
                  showProbabilities={debug.showProbabilities}
                  allTagMetadata={tagFilter.tagMetadata}
                  onRename={acts.rename}
                  onFeedback={acts.feedback}
                  onDelete={handleDelete}
                  onUpdateTags={handleUpdateTags}
                  onSetTagColor={tagFilter.setTagColor}
                />
              </section>

              <section className="app-panel app-panel-tight">
                <DebugPanel debug={debug} />
                <BackupControls
                  exportJson={exportFullBackup}
                  importJson={async (json) => {
                    const firstWheelId = await importFullBackup(json);
                    await wheels.reloadWheels();
                    wheels.switchWheel(firstWheelId);
                    // If the active wheel ID didn't change, force-reload activities + tags.
                    if (firstWheelId === wheels.activeWheelId) {
                      await acts.reload();
                      tagFilter.clearFilter();
                      await tagFilter.reloadMetadata();
                    }
                  }}
                  clearWheel={async () => {
                    await acts.clearEverything();
                    await clearWheelTagMetadata(wheels.activeWheelId);
                    tagFilter.clearFilter();
                    await tagFilter.reloadMetadata();
                  }}
                  clearAllWheels={async () => {
                    const newWheel = await resetToBlankWheel();
                    await wheels.reloadWheels();
                    wheels.switchWheel(newWheel.id);
                  }}
                />
              </section>
            </>
          )}

          <footer className="app-footer">
            <p>Data lives only in this browser (IndexedDB). Use Backup &amp; restore to keep a copy.</p>
          </footer>
        </main>
      </WeightProvider>
    </SpinCountProvider>
  );
}

export default App;
