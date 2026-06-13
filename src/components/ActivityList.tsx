/**
 * Searchable, sortable list of activities. Computes display probabilities
 * from effective weights so the debug panel toggles can show them inline.
 *
 * When a tag filter is active, the list shows only the filtered subset.
 * Probabilities are computed over that same filtered subset so the numbers
 * make sense relative to the wheel pool.
 *
 * Memoization strategy:
 *  - Sort + filter are cheap for ≤200 items but we still memoize to keep
 *    re-renders quiet during typing in the search box.
 *  - Each row is `memo`-ised on its props so adding/removing one item only
 *    re-renders that one (plus probability shifts when weights change).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Activity, FeedbackAction, SortDirection, SortKey, TagMetadata } from '../domain-logic/types';
import { getEffectiveWeight } from '../domain-logic/weight-logic';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';
import { ActivityRow, AddTagCombobox } from './ActivityRow';

interface Props {
  /** The (possibly tag-filtered) activities to display. */
  readonly activities: readonly Activity[];
  readonly showWeights: boolean;
  readonly showProbabilities: boolean;
  readonly allTagMetadata: readonly TagMetadata[];
  onRename(id: string, name: string): Promise<void>;
  onFeedback(id: string, action: FeedbackAction): Promise<void>;
  onDelete(id: string): Promise<void>;
  onUpdateTags(id: string, tags: string[]): Promise<void>;
  onSetTagColor(tagName: string, color: string | null): Promise<void>;
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'createdAt', label: 'Date added' },
  { key: 'name', label: 'Name' },
  { key: 'weight', label: 'Most enjoyed' },
];

export function ActivityList(props: Props) {
  const {
    activities,
    showWeights,
    showProbabilities,
    allTagMetadata,
    onRename,
    onFeedback,
    onDelete,
    onUpdateTags,
    onSetTagColor,
  } = props;
  const globalWeightContext = useWeightContext();
  const now = useNow();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [compactMode, setCompactMode] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Selection state                                                     */
  /* ------------------------------------------------------------------ */

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isDragging = useRef(false);
  const dragMode = useRef<'select' | 'deselect'>('select');

  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    document.addEventListener('mouseup', stop);
    return () => document.removeEventListener('mouseup', stop);
  }, []);

  const handleSelectionMouseDown = useCallback((id: string) => {
    isDragging.current = true;
    setSelectedIds((prev) => {
      const alreadySelected = prev.has(id);
      dragMode.current = alreadySelected ? 'deselect' : 'select';
      const next = new Set(prev);
      if (alreadySelected) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleRowMouseEnter = useCallback((id: string) => {
    if (!isDragging.current) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (dragMode.current === 'select') next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  /* ------------------------------------------------------------------ */
  /* Sort / filter / probabilities                                       */
  /* ------------------------------------------------------------------ */

  const weightRange = useMemo<{ min: number; max: number }>(() => {
    if (activities.length === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const a of activities) {
      const w = getEffectiveWeight(a, now, globalWeightContext);
      if (w < min) min = w;
      if (w > max) max = w;
    }
    return { min, max };
  }, [activities, globalWeightContext, now]);

  /** Probabilities computed over the displayed (filtered) activities only — so
   *  they match what the wheel shows when a tag filter is active. */
  const probabilities = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    let total = 0;
    const eff: { id: string; w: number }[] = [];
    for (const a of activities) {
      const w = getEffectiveWeight(a, now, globalWeightContext);
      eff.push({ id: a.id, w });
      total += w;
    }
    for (const { id, w } of eff) {
      map.set(id, total > 0 ? w / total : 0);
    }
    return map;
  }, [activities, globalWeightContext, now]);

  const probRange = useMemo<{ min: number; max: number }>(() => {
    if (probabilities.size === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const p of probabilities.values()) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
    return { min, max };
  }, [probabilities]);

  const tagCounts = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    for (const a of activities) {
      for (const tag of (a.tags ?? [])) {
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    }
    return map;
  }, [activities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => a.name.toLowerCase().includes(q));
  }, [activities, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name) * dir;
        case 'createdAt':
          return (a.createdAt - b.createdAt) * dir;
        case 'weight': {
          return (
            getEffectiveWeight(a, now, globalWeightContext) -
            getEffectiveWeight(b, now, globalWeightContext)
          ) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortDir, sortKey, globalWeightContext, now]);

  /* ------------------------------------------------------------------ */
  /* Batch selection helpers                                             */
  /* ------------------------------------------------------------------ */

  const isSelectMode = selectedIds.size > 0;
  const allSortedSelected = sorted.length > 0 && sorted.every((a) => selectedIds.has(a.id));

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sorted.every((a) => next.has(a.id))) {
        sorted.forEach((a) => next.delete(a.id));
      } else {
        sorted.forEach((a) => next.add(a.id));
      }
      return next;
    });
  }, [sorted]);

  /** Tags shared by ALL currently selected activities — excluded from batch suggestions. */
  const commonTagsOfSelected = useMemo<string[]>(() => {
    if (selectedIds.size === 0) return [];
    const selected = activities.filter((a) => selectedIds.has(a.id));
    if (selected.length === 0) return [];
    let common = new Set(selected[0].tags ?? []);
    for (const a of selected.slice(1)) {
      const tags = new Set(a.tags ?? []);
      common = new Set([...common].filter((t) => tags.has(t)));
    }
    return [...common];
  }, [activities, selectedIds]);

  const handleBatchAddTag = useCallback(async (tagName: string) => {
    const updates = activities
      .filter((a) => selectedIds.has(a.id) && !(a.tags ?? []).includes(tagName))
      .map((a) => onUpdateTags(a.id, [...(a.tags ?? []), tagName]));
    await Promise.all(updates);
  }, [activities, selectedIds, onUpdateTags]);

  const toggleDir = (): void => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  return (
    <section className="activity-list">
      <div className="activity-list-controls">
        <input
          type="search"
          className="activity-list-search"
          placeholder="Search activities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="activity-list-sort">
          <label className="activity-list-sort-label">Sort:</label>
          <select
            className="activity-list-sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={toggleDir}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        <button
          type="button"
          className={`btn btn-ghost btn-small btn-icon-only${compactMode ? ' btn-compact-active' : ''}`}
          onClick={() => setCompactMode((v) => !v)}
          title={compactMode ? 'Switch to normal view' : 'Switch to compact view'}
          aria-pressed={compactMode}
          aria-label={compactMode ? 'Switch to normal view' : 'Switch to compact view'}
        >
          {compactMode ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="1" y1="2.5" x2="13" y2="2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="1" y1="11.5" x2="13" y2="11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <line x1="1" y1="1.5" x2="13" y2="1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="1" y1="6.5" x2="13" y2="6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="1" y1="11.5" x2="13" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>

      {isSelectMode && (
        <div className="activity-list-batch-bar">
          <span className="batch-count">
            {selectedIds.size} {selectedIds.size === 1 ? 'activity' : 'activities'} selected
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={handleSelectAll}
          >
            {allSortedSelected ? 'Deselect all' : 'Select all'}
          </button>
          <AddTagCombobox
            activityTags={commonTagsOfSelected}
            allTagMetadata={allTagMetadata}
            onAdd={(name) => void handleBatchAddTag(name)}
            triggerLabel={`＋ Add tag${selectedIds.size > 1 ? ` to ${selectedIds.size}` : ''}`}
          />
          <button
            type="button"
            className="btn btn-ghost btn-small batch-clear-btn"
            onClick={() => setSelectedIds(new Set())}
            title="Clear selection"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {activities.length === 0 ? (
        <p className="activity-list-empty">No activities yet — add one above.</p>
      ) : sorted.length === 0 ? (
        <p className="activity-list-empty">No matches for "{query}".</p>
      ) : (
        <ul className={`activity-list-items${compactMode ? ' is-compact' : ''}${isSelectMode ? ' is-select-mode' : ''}`}>
          {sorted.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              probability={probabilities.get(a.id) ?? null}
              showWeights={showWeights}
              showProbabilities={showProbabilities}
              weightMin={weightRange.min}
              weightMax={weightRange.max}
              probMin={probRange.min}
              probMax={probRange.max}
              allTagMetadata={allTagMetadata}
              tagCounts={tagCounts}
              isCompact={compactMode}
              isSelected={selectedIds.has(a.id)}
              isSelectMode={isSelectMode}
              onRename={onRename}
              onFeedback={onFeedback}
              onDelete={onDelete}
              onUpdateTags={onUpdateTags}
              onSetTagColor={onSetTagColor}
              onSelectionMouseDown={handleSelectionMouseDown}
              onRowMouseEnter={handleRowMouseEnter}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
