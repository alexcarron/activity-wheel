/**
 * TagFilterBar. The tag filter UI positioned near the wheel.
 * Contains:
 * - A search input that filters the pill list (doesn't affect the wheel directly)
 * - "All" pill (clears filter)
 * - "Untagged" pseudo-pill (shows only activities with no tags)
 * - Scrollable row of tag pills with count badges
 * - AND/OR toggle (only visible when 2+ tags are active)
 * - Digit hotkeys (1–9) on the first 9 pills sorted by popularity
 * The filter state lives in the parent (App) via useTagFilter. This is purely presentational plus hotkey wiring. 
 */

import { useMemo, useRef, useState } from 'react';
import type { Activity, TagMetadata } from '../domain-logic/types';
import type { FilterMode } from '../domain-logic/tag-filter-logic';
import { computeTagCounts, countUntagged, isFilterActive } from '../domain-logic/tag-filter-logic';
import { useHotkey } from '../hooks/useHotkey';
import { TAG_HOTKEYS } from '../constants/hotkeys';

interface Props {
	/** Full (unfiltered) activity list. Needed for accurate counts. */
	readonly allActivities: readonly Activity[];
	readonly tagMetadata: readonly TagMetadata[];
	readonly activeTags: readonly string[];
	readonly untaggedOnly: boolean;
	readonly filterMode: FilterMode;
	onToggleTag(name: string): void;
	onToggleUntagged(): void;
	onClearFilter(): void;
	onToggleMode(): void;
}

export function TagFilterBar({
	allActivities,
	tagMetadata,
	activeTags,
	untaggedOnly,
	filterMode,
	onToggleTag,
	onToggleUntagged,
	onClearFilter,
	onToggleMode,
}: Props) {
	const [searchQuery, setSearchQuery] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);

	/* Counts for badge labels */
	const tagCounts = useMemo(() => computeTagCounts(allActivities), [allActivities]);
	const untaggedCount = useMemo(() => countUntagged(allActivities), [allActivities]);

	/* Tags sorted by activity count (most popular first). Used for both display ordering and assigning digit hotkeys */
	const sortedTags = useMemo<(TagMetadata & { count: number })[]>(() => {
		return [...tagMetadata]
			.map((tag) => ({ ...tag, count: tagCounts.get(tag.name) ?? 0 }))
			.sort((tag1, tag2) => tag2.count - tag1.count || tag1.name.localeCompare(tag2.name))
			.sort((tag1, tag2) => (tag2.color ? 1 : 0) - (tag1.color ? 1 : 0)); // tags with colors first
	}, [tagMetadata, tagCounts]);

	/* Filter the displayed pills by the search query */
	const displayedTags = useMemo(() => {
		const queryText = searchQuery.trim().toLowerCase();
		if (!queryText) return sortedTags;
		return sortedTags.filter((tag) => tag.name.toLowerCase().includes(queryText));
	}, [sortedTags, searchQuery]);

	const filterOn = isFilterActive(activeTags, untaggedOnly);
	const multiTagActive = activeTags.length >= 2;

	/* Digit hotkeys for top-9 tags. React rules forbid hooks in loops, so we inline 9 calls. Each one is enabled only when the corresponding tag exists and we're not in a text input (useHotkey handles that internally). */
	useHotkey(
		TAG_HOTKEYS[0].code,
		() => sortedTags[0] && onToggleTag(sortedTags[0].name),
		sortedTags.length >= 1,
	);
	useHotkey(
		TAG_HOTKEYS[1].code,
		() => sortedTags[1] && onToggleTag(sortedTags[1].name),
		sortedTags.length >= 2,
	);
	useHotkey(
		TAG_HOTKEYS[2].code,
		() => sortedTags[2] && onToggleTag(sortedTags[2].name),
		sortedTags.length >= 3,
	);
	useHotkey(
		TAG_HOTKEYS[3].code,
		() => sortedTags[3] && onToggleTag(sortedTags[3].name),
		sortedTags.length >= 4,
	);
	useHotkey(
		TAG_HOTKEYS[4].code,
		() => sortedTags[4] && onToggleTag(sortedTags[4].name),
		sortedTags.length >= 5,
	);
	useHotkey(
		TAG_HOTKEYS[5].code,
		() => sortedTags[5] && onToggleTag(sortedTags[5].name),
		sortedTags.length >= 6,
	);
	useHotkey(
		TAG_HOTKEYS[6].code,
		() => sortedTags[6] && onToggleTag(sortedTags[6].name),
		sortedTags.length >= 7,
	);
	useHotkey(
		TAG_HOTKEYS[7].code,
		() => sortedTags[7] && onToggleTag(sortedTags[7].name),
		sortedTags.length >= 8,
	);
	useHotkey(
		TAG_HOTKEYS[8].code,
		() => sortedTags[8] && onToggleTag(sortedTags[8].name),
		sortedTags.length >= 9,
	);

	if (tagMetadata.length === 0 && untaggedCount === 0) {
		// Nothing to filter yet. Hide the bar entirely to keep the UI clean
		return null;
	}

	return (
		<div className={`tag-filter-bar${filterOn ? ' tag-filter-bar-active' : ''}`}>
			<div className="tag-filter-top-row">
				<input
					ref={searchRef}
					type="search"
					className="tag-filter-search"
					placeholder="Filter tags…"
					value={searchQuery}
					onChange={(event) => setSearchQuery(event.target.value)}
					aria-label="Search tags"
				/>
				{multiTagActive && (
					<button
						type="button"
						className={`btn btn-small tag-filter-mode-toggle${filterMode === 'AND' ? ' tag-filter-mode-and' : ''}`}
						onClick={onToggleMode}
						title={
							filterMode === 'OR'
								? 'Currently OR (activities matching ANY active tag. Click to switch to AND)'
								: 'Currently AND (activities must match ALL active tags. Click to switch to OR)'
						}
					>
						{filterMode}
					</button>
				)}
			</div>

			<div className="tag-filter-pills" role="group" aria-label="Tag filters">
				{/* All pill. Always first */}
				<button
					type="button"
					className={`tag-pill${!filterOn ? ' tag-pill-active' : ''}`}
					onClick={onClearFilter}
					aria-pressed={!filterOn}
				>
					All
				</button>

				{/* Untagged pseudo-pill */}
				{untaggedCount > 0 && (
					<button
						type="button"
						className={`tag-pill tag-pill-untagged${untaggedOnly ? ' tag-pill-active' : ''}`}
						onClick={onToggleUntagged}
						aria-pressed={untaggedOnly}
					>
						Untagged <span className="tag-pill-count">({untaggedCount})</span>
					</button>
				)}

				{/* Regular tag pills */}
				{displayedTags.map((tag) => {
					/* Find this tag's position in the full sorted list to assign hotkey */
					const globalIndex = sortedTags.indexOf(tag);
					const hotkey = globalIndex >= 0 && globalIndex < 9 ? TAG_HOTKEYS[globalIndex].label : null;
					const isActive = activeTags.includes(tag.name);

					const pillStyle =
						tag.color && isActive
							? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' }
							: tag.color
								? { borderColor: tag.color, color: tag.color }
								: undefined;

					return (
						<button
							key={tag.name}
							type="button"
							className={`tag-pill${isActive ? ' tag-pill-active' : ''}`}
							style={pillStyle}
							onClick={() => onToggleTag(tag.name)}
							aria-pressed={isActive}
							title={
								hotkey ? `Toggle "${tag.name}" filter (${hotkey})` : `Toggle "${tag.name}" filter`
							}
						>
							{tag.name}
							<span className="tag-pill-count"> ({tag.count})</span>
							{hotkey && <kbd className="tag-pill-hotkey">{hotkey}</kbd>}
						</button>
					);
				})}
			</div>
		</div>
	);
}
