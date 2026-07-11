import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
	Activity,
	FeedbackAction,
	SortDirection,
	SortKey,
	TagMetadata,
} from '../domain-logic/types';
import { applySpreadToWeights } from '../domain-logic/weight-logic/weight-spread-logic';
import { getEffectiveWeight } from '../domain-logic/weight-logic/effective-weight-logic';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';
import { ActivityRow, AddTagCombobox } from './ActivityRow';

interface ActivityListProps {
	/** The possibly tag-filtered activities to display. */
	readonly activities: readonly Activity[];
	readonly showWeights: boolean;
	readonly showProbabilities: boolean;
	readonly spreadFactor: number;
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

/**
 * Searchable, sortable list of activities. 
 */
export function ActivityList(props: ActivityListProps) {
	const {
		activities,
		showWeights,
		showProbabilities,
		spreadFactor,
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
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
	const [compactMode, setCompactMode] = useState(false);

	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const isDragging = useRef(false);
	const dragMode = useRef<'select' | 'deselect'>('select');

	useEffect(() => {
		const stop = () => {
			isDragging.current = false;
		};
		document.addEventListener('mouseup', stop);
		return () => document.removeEventListener('mouseup', stop);
	}, []);

	const handleSelectionMouseDown = useCallback((id: string) => {
		isDragging.current = true;
		setSelectedIds((prev) => {
			const alreadySelected = prev.has(id);
			dragMode.current = alreadySelected ? 'deselect' : 'select';
			const next = new Set(prev);
			if (alreadySelected) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const handleRowMouseEnter = useCallback((id: string) => {
		if (!isDragging.current) return;
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (dragMode.current === 'select') next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const weightRange = useMemo<{ min: number; max: number }>(() => {
		if (activities.length === 0) return { min: 0, max: 1 };
		let minWeight = Infinity;
		let maxWeight = -Infinity;
		for (const activity of activities) {
			const effectiveWeight = getEffectiveWeight(activity, now, globalWeightContext);
			if (effectiveWeight < minWeight) minWeight = effectiveWeight;
			if (effectiveWeight > maxWeight) maxWeight = effectiveWeight;
		}
		return { min: minWeight, max: maxWeight };
	}, [activities, globalWeightContext, now]);

	/**
	 * Probabilities computed over the filtered activities only so they match what the wheel shows when a tag filter is active. Spread is applied here too so the debug pill matches the wheel's actual odds. 
 */
	const probabilities = useMemo<Map<string, number>>(() => {
		const map = new Map<string, number>();
		const effectiveWeights = activities.map((activity) => getEffectiveWeight(activity, now, globalWeightContext));
		const spreadWeights = applySpreadToWeights(effectiveWeights, spreadFactor);
		const total = spreadWeights.reduce((sum, weight) => sum + weight, 0);
		activities.forEach((activity, index) => {
			map.set(activity.id, total > 0 ? spreadWeights[index] / total : 0);
		});
		return map;
	}, [activities, globalWeightContext, now, spreadFactor]);

	const probabilityRange = useMemo<{ min: number; max: number }>(() => {
		if (probabilities.size === 0) return { min: 0, max: 1 };
		let min = Infinity;
		let max = -Infinity;
		for (const probability of probabilities.values()) {
			if (probability < min) min = probability;
			if (probability > max) max = probability;
		}
		return { min, max };
	}, [probabilities]);

	const tagCounts = useMemo<Map<string, number>>(() => {
		const map = new Map<string, number>();
		for (const activity of activities) {
			for (const tag of activity.tags ?? []) {
				map.set(tag, (map.get(tag) ?? 0) + 1);
			}
		}
		return map;
	}, [activities]);

	const filteredActivities = useMemo(() => {
		const queryText = query.trim().toLowerCase();
		if (!queryText) return activities;
		return activities.filter((activity) => activity.name.toLowerCase().includes(queryText));
	}, [activities, query]);

	const sorted = useMemo(() => {
		const filteredActivitiesCopy = [...filteredActivities];
		const direction = sortDirection === 'asc' ? 1 : -1;
		filteredActivitiesCopy.sort((activity1, activity2) => {
			switch (sortKey) {
				case 'name':
					return activity1.name.localeCompare(activity2.name) * direction;
				case 'createdAt':
					return (activity1.createdAt - activity2.createdAt) * direction;
				case 'weight': {
					return (
						(getEffectiveWeight(activity1, now, globalWeightContext) -
							getEffectiveWeight(activity2, now, globalWeightContext)) *
						direction
					);
				}
			}
		});
		return filteredActivitiesCopy;
	}, [filteredActivities, sortDirection, sortKey, globalWeightContext, now]);

	const isSelectMode = selectedIds.size > 0;
	const allSortedSelected = sorted.length > 0 && sorted.every((activity) => selectedIds.has(activity.id));

	const handleSelectAll = useCallback(() => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (sorted.every((activity) => next.has(activity.id))) {
				sorted.forEach((activity) => next.delete(activity.id));
			}
			else {
				sorted.forEach((activity) => next.add(activity.id));
			}
			return next;
		});
	}, [sorted]);

	/** Tags shared by all currently selected activities */
	const commonTagsOfSelected = useMemo<string[]>(() => {
		if (selectedIds.size === 0) return [];
		const selected = activities.filter((activity) => selectedIds.has(activity.id));
		if (selected.length === 0) return [];
		let common = new Set(selected[0].tags ?? []);
		for (const activity of selected.slice(1)) {
			const tags = new Set(activity.tags ?? []);
			common = new Set([...common].filter((tag) => tags.has(tag)));
		}
		return [...common];
	}, [activities, selectedIds]);

	const handleBatchAddTag = useCallback(
		async (tagName: string) => {
			const updates = activities
				.filter((activity) => selectedIds.has(activity.id) && !(activity.tags ?? []).includes(tagName))
				.map((activity) => onUpdateTags(activity.id, [...(activity.tags ?? []), tagName]));
			await Promise.all(updates);
		},
		[activities, selectedIds, onUpdateTags],
	);

	const toggleSortDirection = (): void => setSortDirection((currentDirection) => (currentDirection === 'asc' ? 'desc' : 'asc'));

	return (
		<section className="activity-list">
			<div className="activity-list-header">
				<div className={`activity-list-controls${isSelectMode ? ' is-hidden' : ''}`}>
					<input
						type="search"
						className="activity-list-search"
						placeholder="Search activities…"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<div className="activity-list-sort">
						<label className="activity-list-sort-label">Sort:</label>
						<select
							className="activity-list-sort-select"
							value={sortKey}
							onChange={(event) => setSortKey(event.target.value as SortKey)}
						>
							{SORTS.map((sortOption) => (
								<option key={sortOption.key} value={sortOption.key}>
									{sortOption.label}
								</option>
							))}
						</select>
						<button
							type="button"
							className="btn btn-ghost btn-small"
							onClick={toggleSortDirection}
							title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
						>
							{sortDirection === 'asc' ? '↑' : '↓'}
						</button>
					</div>
					<button
						type="button"
						className={`btn btn-ghost btn-small btn-icon-only${compactMode ? ' btn-compact-active' : ''}`}
						onClick={() => setCompactMode((wasCompact) => !wasCompact)}
						title={compactMode ? 'Switch to normal view' : 'Switch to compact view'}
						aria-pressed={compactMode}
						aria-label={compactMode ? 'Switch to normal view' : 'Switch to compact view'}
					>
						{compactMode ? (
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
								<line
									x1="1"
									y1="2.5"
									x2="13"
									y2="2.5"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="7"
									x2="13"
									y2="7"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="11.5"
									x2="13"
									y2="11.5"
									stroke="currentColor"
									strokeWidth="1.8"
									strokeLinecap="round"
								/>
							</svg>
						) : (
							<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
								<line
									x1="1"
									y1="1.5"
									x2="13"
									y2="1.5"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="4"
									x2="13"
									y2="4"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="6.5"
									x2="13"
									y2="6.5"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="9"
									x2="13"
									y2="9"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
								<line
									x1="1"
									y1="11.5"
									x2="13"
									y2="11.5"
									stroke="currentColor"
									strokeWidth="1.3"
									strokeLinecap="round"
								/>
							</svg>
						)}
					</button>
				</div>

				{isSelectMode && (
					<div className="activity-list-batch-bar">
						<span className="batch-count">
							{selectedIds.size} {selectedIds.size === 1 ? 'activity' : 'activities'} selected
						</span>
						<button type="button" className="btn btn-ghost btn-small" onClick={handleSelectAll}>
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
			</div>

			{activities.length === 0 ? (
				<p className="activity-list-empty">No activities yet. Add one above.</p>
			) : sorted.length === 0 ? (
				<p className="activity-list-empty">No matches for "{query}".</p>
			) : (
				<ul
					className={`activity-list-items${compactMode ? ' is-compact' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
				>
					{sorted.map((activity) => (
						<ActivityRow
							key={activity.id}
							activity={activity}
							probability={probabilities.get(activity.id) ?? null}
							showWeights={showWeights}
							showProbabilities={showProbabilities}
							weightMinimum={weightRange.min}
							weightMaximum={weightRange.max}
							probabilityMinimum={probabilityRange.min}
							probabilityMaximum={probabilityRange.max}
							allTagMetadata={allTagMetadata}
							tagCounts={tagCounts}
							isCompact={compactMode}
							isSelected={selectedIds.has(activity.id)}
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
