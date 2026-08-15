import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
	Activity,
	FeedbackAction,
	SortDirection,
	SortKey,
	TagMetadata,
} from '../domain-logic/types';
import { getPreferenceScoreStandardDeviation } from '../domain-logic/weight-logic/preference-to-weight-logic';
import {
	estimateStableProbabilities,
	estimateStableWeights,
} from '../domain-logic/weight-logic/stable-probability-estimate-logic';
import { getDecayedPreferenceScoreConfidence } from '../domain-logic/weight-logic/confidence-decay-logic';
import { defaultRng } from '../utils/random-utils';
import { useNow } from '../hooks/useNow';
import { ActivityRow, AddTagCombobox } from './ActivityRow';
import { DEBUG_VALUE_PILL_KEYS, type DebugValuePillKey } from './debug-value-pills';
import './ActivityList.css';

interface ActivityListProps {
	/** The possibly tag-filtered activities to display. */
	readonly activities: readonly Activity[];
	readonly debugValuePillKeyToIsVisible: Record<DebugValuePillKey, boolean>;
	readonly spreadFactor: number;
	readonly allTagMetadata: readonly TagMetadata[];
	/** The locked-in actual current weight for each activity, held steady until the wheel is spun, feedback is given, or an activity is added/removed. */
	readonly lockedActualWeightByActivityID: Map<string, number>;
	/** The locked-in actual current probability for each activity, derived from the same weight above. */
	readonly lockedActualProbabilityByActivityID: Map<string, number>;
	onRename(id: string, name: string): Promise<void>;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onDelete(id: string): Promise<void>;
	onUpdateTags(id: string, tagIds: string[]): Promise<void>;
	onAddTag(id: string, tagName: string): Promise<void>;
	onSetTagColor(tagID: string, color: string | null): Promise<void>;
	onRenameTag(tagID: string, newName: string): Promise<void>;
	onDeleteTag(tagID: string): Promise<void>;
	onAddTagByName(tagName: string, activityIDs: readonly string[]): Promise<void>;
	/** Forwarded to every row; see ActivityRow's onEditingChange doc comment. */
	onEditingChange?(activityID: string, isEditing: boolean): void;
}

const SORTS: { key: SortKey; label: string }[] = [
	{ key: 'createdAt', label: 'Date added' },
	{ key: 'name', label: 'Name' },
	{ key: 'preferenceScore', label: 'Most enjoyed' },
	{ key: 'decayedPreferenceScoreConfidence', label: 'Most feedback given' },
];

/**
 * Searchable, sortable list of activities. 
 */
export function ActivityList(props: ActivityListProps) {
	const {
		activities,
		debugValuePillKeyToIsVisible,
		spreadFactor,
		allTagMetadata,
		lockedActualWeightByActivityID,
		lockedActualProbabilityByActivityID,
		onRename,
		onFeedback,
		onDelete,
		onUpdateTags,
		onAddTag,
		onSetTagColor,
		onRenameTag,
		onDeleteTag,
		onAddTagByName,
		onEditingChange,
	} = props;
	const now = useNow();
	const [query, setQuery] = useState('');
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
	const [compactMode, setCompactMode] = useState(false);

	const [selectedIDs, setSelectedIDs] = useState<Set<string>>(new Set());
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
		setSelectedIDs((prev) => {
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
		setSelectedIDs((prev) => {
			const next = new Set(prev);
			if (dragMode.current === 'select') next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const isAnyDebugPillVisible = useMemo(
		() => DEBUG_VALUE_PILL_KEYS.some((key) => debugValuePillKeyToIsVisible[key]),
		[debugValuePillKeyToIsVisible],
	);

	const { debugValuesByActivityID, debugRangesByKey } = useMemo(() => {
		const valuesByActivityID = new Map<string, Record<DebugValuePillKey, number>>();
		const emptyRanges = {} as Record<DebugValuePillKey, { min: number; max: number }>;
		for (const key of DEBUG_VALUE_PILL_KEYS) emptyRanges[key] = { min: 0, max: 1 };
		if (!isAnyDebugPillVisible || activities.length === 0) {
			return { debugValuesByActivityID: valuesByActivityID, debugRangesByKey: emptyRanges };
		}

		const estimatedStableWeights = estimateStableWeights({ activities, now, rng: defaultRng });
		const estimatedStableProbabilities = estimateStableProbabilities({ activities, now, rng: defaultRng, spreadFactor });

		activities.forEach((activity, index) => {
			const decayedPreferenceScoreConfidence = getDecayedPreferenceScoreConfidence({
				preferenceScoreConfidence: activity.preferenceScoreConfidence,
				lastFeedbackAt: activity.lastFeedbackAt,
				now,
			});
			valuesByActivityID.set(activity.id, {
				actualCurrentWeight: lockedActualWeightByActivityID.get(activity.id) ?? 0,
				estimatedStableWeight: estimatedStableWeights[index],
				actualCurrentProbability: lockedActualProbabilityByActivityID.get(activity.id) ?? 0,
				estimatedStableProbability: estimatedStableProbabilities[index],
				preferenceScore: activity.preferenceScore,
				preferenceScoreConfidence: activity.preferenceScoreConfidence,
				decayedPreferenceScoreConfidence,
				preferenceScoreStandardDeviation: getPreferenceScoreStandardDeviation(decayedPreferenceScoreConfidence),
			});
		});

		const rangesByKey = {} as Record<DebugValuePillKey, { min: number; max: number }>;
		for (const key of DEBUG_VALUE_PILL_KEYS) {
			let min = Infinity;
			let max = -Infinity;
			for (const values of valuesByActivityID.values()) {
				const value = values[key];
				if (value < min) min = value;
				if (value > max) max = value;
			}
			if (!isFinite(min) || !isFinite(max)) {
				min = 0;
				max = 1;
			}
			rangesByKey[key] = { min, max };
		}
		return { debugValuesByActivityID: valuesByActivityID, debugRangesByKey: rangesByKey };
	}, [isAnyDebugPillVisible, activities, now, spreadFactor, lockedActualWeightByActivityID, lockedActualProbabilityByActivityID]);

	const tagIDToCount = useMemo<Map<string, number>>(() => {
		const tagIDToCount = new Map<string, number>();
		for (const activity of activities) {
			for (const tagID of activity.tagIds ?? []) {
				tagIDToCount.set(tagID, (tagIDToCount.get(tagID) ?? 0) + 1);
			}
		}
		return tagIDToCount;
	}, [activities]);

	const filteredActivities = useMemo(() => {
		const queryText = query.trim().toLowerCase();
		if (!queryText) return activities;
		return activities.filter((activity) => activity.name.toLowerCase().includes(queryText));
	}, [activities, query]);

	const sortedActivities = useMemo(() => {
		const filteredActivitiesCopy = [...filteredActivities];
		const direction = sortDirection === 'asc' ? 1 : -1;
		filteredActivitiesCopy.sort((activity1, activity2) => {
			switch (sortKey) {
				case 'name':
					return activity1.name.localeCompare(activity2.name) * direction;
				case 'createdAt':
					return (activity1.createdAt - activity2.createdAt) * direction;
				case 'preferenceScore':
					return (activity1.preferenceScore - activity2.preferenceScore) * direction;
				case 'decayedPreferenceScoreConfidence':
					return (
						(getDecayedPreferenceScoreConfidence({
							preferenceScoreConfidence: activity1.preferenceScoreConfidence,
							lastFeedbackAt: activity1.lastFeedbackAt,
							now,
						}) -
							getDecayedPreferenceScoreConfidence({
								preferenceScoreConfidence: activity2.preferenceScoreConfidence,
								lastFeedbackAt: activity2.lastFeedbackAt,
								now,
							})) * direction
					);
			}
		});
		return filteredActivitiesCopy;
	}, [filteredActivities, sortDirection, sortKey, now]);

	const isSelectMode = selectedIDs.size > 0;
	const allSortedSelected = sortedActivities.length > 0 && sortedActivities.every((activity) => selectedIDs.has(activity.id));

	const handleSelectAll = useCallback(() => {
		setSelectedIDs((prev) => {
			const next = new Set(prev);
			if (sortedActivities.every((activity) => next.has(activity.id))) {
				sortedActivities.forEach((activity) => next.delete(activity.id));
			}
			else {
				sortedActivities.forEach((activity) => next.add(activity.id));
			}
			return next;
		});
	}, [sortedActivities]);

	const commonTagIDsOfSelected = useMemo<string[]>(() => {
		if (selectedIDs.size === 0) return [];
		const selectedActivities = activities.filter((activity) => selectedIDs.has(activity.id));
		if (selectedActivities.length === 0) return [];
		let commonTagIDs = new Set(selectedActivities[0].tagIds ?? []);
		for (const activity of selectedActivities.slice(1)) {
			const tagIDs = new Set(activity.tagIds ?? []);
			commonTagIDs = new Set([...commonTagIDs].filter((tagID) => tagIDs.has(tagID)));
		}
		return [...commonTagIDs];
	}, [activities, selectedIDs]);

	const handleBatchAddTag = useCallback(
		async (tagName: string) => {
			await onAddTagByName(tagName, [...selectedIDs]);
		},
		[selectedIDs, onAddTagByName],
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
							{selectedIDs.size} {selectedIDs.size === 1 ? 'activity' : 'activities'} selected
						</span>
						<button type="button" className="btn btn-ghost btn-small" onClick={handleSelectAll}>
							{allSortedSelected ? 'Deselect all' : 'Select all'}
						</button>
						<AddTagCombobox
							activityTagIDs={commonTagIDsOfSelected}
							allTagMetadata={allTagMetadata}
							onAdd={(name) => void handleBatchAddTag(name)}
							triggerLabel={`＋ Add tag${selectedIDs.size > 1 ? ` to ${selectedIDs.size}` : ''}`}
						/>
						<button
							type="button"
							className="btn btn-ghost btn-small batch-clear-btn"
							onClick={() => setSelectedIDs(new Set())}
							title="Clear selection"
						>
							✕ Clear
						</button>
					</div>
				)}
			</div>

			{activities.length === 0 ? (
				<p className="activity-list-empty">No activities yet. Add one above.</p>
			) : sortedActivities.length === 0 ? (
				<p className="activity-list-empty">No matches for "{query}".</p>
			) : (
				<ul
					className={`activity-list-items${compactMode ? ' is-compact' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
				>
					{sortedActivities.map((activity) => (
						<ActivityRow
							key={activity.id}
							activity={activity}
							debugValues={debugValuesByActivityID.get(activity.id) ?? null}
							debugRanges={debugRangesByKey}
							debugValuePillKeyToIsVisible={debugValuePillKeyToIsVisible}
							allTagMetadata={allTagMetadata}
							tagCounts={tagIDToCount}
							isCompact={compactMode}
							isSelected={selectedIDs.has(activity.id)}
							isSelectMode={isSelectMode}
							onRename={onRename}
							onFeedback={onFeedback}
							onDelete={onDelete}
							onUpdateTags={onUpdateTags}
							onAddTag={onAddTag}
							onSetTagColor={onSetTagColor}
							onRenameTag={onRenameTag}
							onDeleteTag={onDeleteTag}
							onSelectionMouseDown={handleSelectionMouseDown}
							onRowMouseEnter={handleRowMouseEnter}
							onEditingChange={onEditingChange}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
