/**
 * One row in the activity list.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { getEffectiveWeight } from '../domain-logic/weight-logic/effective-weight-logic';
import { formatDate, formatPercent, formatWeight } from '../utils/format';
import { clampToViewport } from '../utils/clamp-to-viewport';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';
import { useTagColorPickerPopover } from '../hooks/useTagColorPickerPopover';
import { TagColorPickerPopover } from './TagColorPicker';
import './ActivityRow.css';

function TrashIcon() {
	return (
		<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M2 4h12M5.5 4V3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 .5.5v1M3 4l.75 8a.75.75 0 0 0 .75.7h8a.75.75 0 0 0 .75-.7L13 4"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<line
				x1="6"
				y1="7"
				x2="6"
				y2="11"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
			<line
				x1="10"
				y1="7"
				x2="10"
				y2="11"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function CheckIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
			<path
				d="M2 5l2.5 2.5 4-4"
				stroke="white"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function DeleteButton({ onClick, disabled }: { onClick(): void; disabled: boolean }) {
	return (
		<button
			type="button"
			className="icon-btn icon-btn-delete"
			onClick={onClick}
			disabled={disabled}
			title="Delete activity"
			aria-label="Delete activity"
		>
			<TrashIcon />
		</button>
	);
}

interface TagPillProps {
	name: string;
	color?: string;
	count: number;
	onRemove(): void;
	onSetColor(color: string | null): void;
}

function TagPill({ name, color, count, onRemove, onSetColor }: TagPillProps) {
	const pillRef = useRef<HTMLSpanElement>(null);
	const { isOpen, position, popoverRef, open, close } = useTagColorPickerPopover(pillRef);

	const pillStyle: CSSProperties = color ? { borderColor: color, color: color } : {};

	return (
		<>
			<span
				ref={pillRef}
				className="activity-tag-pill"
				style={pillStyle}
				onClick={open}
				onContextMenu={open}
				title={`${name} (click to change color)`}
			>
				{name}
				<span className="activity-tag-pill-suffix">
					<span className="activity-tag-count">{count}</span>
					<button
						type="button"
						className="activity-tag-remove"
						onClick={(event) => {
							event.stopPropagation();
							onRemove();
						}}
						aria-label={`Remove tag "${name}"`}
						tabIndex={-1}
					>
						✕
					</button>
				</span>
			</span>

			{isOpen && (
				<TagColorPickerPopover
					tagName={name}
					color={color}
					position={position}
					popoverRef={popoverRef}
					onSetColor={onSetColor}
					onClose={close}
				/>
			)}
		</>
	);
}

interface AddTagComboboxProps {
	activityTags: string[];
	allTagMetadata: readonly TagMetadata[];
	onAdd(name: string): void;
	/** When provided, renders a full button instead of the ＋ pill. */
	triggerLabel?: string;
}

export function AddTagCombobox({
	activityTags,
	allTagMetadata,
	onAdd,
	triggerLabel,
}: AddTagComboboxProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');
	const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 220 });
	const buttonRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const openCombobox = useCallback(() => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			const dropdownWidth = 220;
			const clamped = clampToViewport(
				rect.left + window.scrollX,
				rect.bottom + window.scrollY + 4,
				dropdownWidth,
				260,
			);
			setDropdownPosition({ ...clamped, width: dropdownWidth });
		}
		setQuery('');
		setOpen(true);
	}, []);

	const closeCombobox = useCallback(() => {
		setOpen(false);
		setQuery('');
	}, []);

	// Auto-focus input when opened
	useEffect(() => {
		if (open) {
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handler = (event: globalThis.MouseEvent) => {
			const target = event.target as HTMLElement;
			if (
				!target.closest('.tag-combobox-dropdown') &&
				!(buttonRef.current?.contains(target) ?? false)
			) {
				closeCombobox();
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [open, closeCombobox]);

	const suggestions = (() => {
		const queryText = query.trim().toLowerCase();
		return allTagMetadata
			.map((tag) => tag.name)
			.filter((name) => !activityTags.includes(name)) // exclude already-added
			.filter((name) => !queryText || name.toLowerCase().includes(queryText))
			.slice(0, 12);
	})();

	const queryTrimmed = query.trim();
	const exactMatch = allTagMetadata.some(
		(tag) => tag.name.toLowerCase() === queryTrimmed.toLowerCase(),
	);
	const showCreate = queryTrimmed.length > 0 && !exactMatch;

	const confirm = useCallback(
		(name: string) => {
			const trimmed = name.trim();
			if (!trimmed) return;
			onAdd(trimmed);
			closeCombobox();
		},
		[onAdd, closeCombobox],
	);

	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				if (suggestions.length === 1) {
					confirm(suggestions[0]);
				}
				else if (queryTrimmed) {
					confirm(queryTrimmed);
				}
			}
			else if (event.key === 'Escape') {
				closeCombobox();
			}
		},
		[closeCombobox, confirm, queryTrimmed, suggestions],
	);

	return (
		<>
			{triggerLabel ? (
				<button
					ref={buttonRef}
					type="button"
					className="btn btn-ghost btn-small"
					onClick={openCombobox}
					aria-label={triggerLabel}
				>
					{triggerLabel}
				</button>
			) : (
				<button
					ref={buttonRef}
					type="button"
					className="activity-tag-add"
					onClick={openCombobox}
					title="Add a tag"
					aria-label="Add a tag"
				>
					＋
				</button>
			)}

			{open &&
				createPortal(
					<div
						ref={dropdownRef}
						className="tag-combobox-dropdown"
						style={{
							position: 'absolute',
							top: dropdownPosition.top,
							left: dropdownPosition.left,
							width: dropdownPosition.width,
						}}
						role="dialog"
						aria-label="Add tag"
					>
						<input
							ref={inputRef}
							type="text"
							className="tag-combobox-input"
							placeholder="Type or pick a tag…"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={onKeyDown}
							maxLength={60}
							autoComplete="off"
						/>
						<ul className="tag-combobox-list" role="listbox">
							{suggestions.length === 0 && !showCreate && (
								<li className="tag-combobox-empty">
									{queryTrimmed
										? `No existing tags match "${queryTrimmed}"`
										: 'No other tags yet (type to create one)'}
								</li>
							)}
							{suggestions.map((name) => (
								<li
									key={name}
									className="tag-combobox-option"
									role="option"
									aria-selected={false}
									onMouseDown={(event) => {
										event.preventDefault();
										confirm(name);
									}}
								>
									{name}
								</li>
							))}
							{showCreate && (
								<li
									className="tag-combobox-option tag-combobox-create"
									role="option"
									aria-selected={false}
									onMouseDown={(event) => {
										event.preventDefault();
										confirm(queryTrimmed);
									}}
								>
									Create "{queryTrimmed}"
								</li>
							)}
						</ul>
					</div>,
					document.body,
				)}
		</>
	);
}

interface Props {
	readonly activity: Activity;
	readonly probability: number | null;
	readonly showWeights: boolean;
	readonly showProbabilities: boolean;
	readonly weightMinimum: number;
	readonly weightMaximum: number;
	readonly probabilityMinimum: number;
	readonly probabilityMaximum: number;
	readonly allTagMetadata: readonly TagMetadata[];
	readonly tagCounts: ReadonlyMap<string, number>;
	readonly isCompact?: boolean;
	readonly isSelected: boolean;
	readonly isSelectMode: boolean;
	onRename(id: string, name: string): Promise<void>;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onDelete(id: string): Promise<void>;
	onUpdateTags(id: string, tags: string[]): Promise<void>;
	onSetTagColor(tagName: string, color: string | null): Promise<void>;
	onSelectionMouseDown(id: string): void;
	onRowMouseEnter(id: string): void;
	/** Called whenever this row's inline rename editor opens/closes. Used to detect confusing remote changes to a shared wheel while a name edit is in progress. */
	onEditingChange?(activityId: string, isEditing: boolean): void;
}

/** Returns a linear-gradient pill style that shows a bar-chart fill colored red (lowest) → amber (middle) → green (highest), matching --hate / --warn / --good, based on the value's position within the provided min/max range. */
function getBarPillStyle(value: number, min: number, max: number): CSSProperties {
	const range = max - min;
	const normalizedPosition = range === 0 ? 1 : Math.max(0, Math.min(1, (value - min) / range));

	let red: number, green: number, blue: number;
	if (normalizedPosition <= 0.5) {
		const blendRatio = normalizedPosition * 2;
		red = Math.round(201 + (240 - 201) * blendRatio);
		green = Math.round(42 + (140 - 42) * blendRatio);
		blue = Math.round(42 + (0 - 42) * blendRatio);
	}
	else {
		const blendRatio = (normalizedPosition - 0.5) * 2;
		red = Math.round(240 + (55 - 240) * blendRatio);
		green = Math.round(140 + (178 - 140) * blendRatio);
		blue = Math.round(0 + (77 - 0) * blendRatio);
	}

	const fillPercent = 5 + normalizedPosition * 95;
	const fillColor = `rgba(${red}, ${green}, ${blue}, 0.55)`;
	const borderColor = `rgb(${red}, ${green}, ${blue})`;

	return {
		background: `linear-gradient(to right, ${fillColor} ${fillPercent}%, var(--bg-soft) ${fillPercent}%)`,
		borderColor,
	};
}

function ActivityRowComponent({
	activity,
	probability,
	showWeights,
	showProbabilities,
	weightMinimum,
	weightMaximum,
	probabilityMinimum,
	probabilityMaximum,
	allTagMetadata,
	tagCounts,
	isCompact = false,
	isSelected,
	isSelectMode,
	onRename,
	onFeedback,
	onDelete,
	onUpdateTags,
	onSetTagColor,
	onSelectionMouseDown,
	onRowMouseEnter,
	onEditingChange,
}: Props) {
	const globalWeightContext = useWeightContext();
	const now = useNow();
	const [isEditingName, setIsEditingName] = useState(false);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const effectiveWeight = getEffectiveWeight(activity, now, globalWeightContext);
	const hasTags = (activity.tags ?? []).length > 0;

	useEffect(() => {
		if (isEditingName && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditingName]);

	useEffect(() => {
		onEditingChange?.(activity.id, isEditingName);
		// Cleanup handles the row unmounting mid-edit.
		return () => {
			if (isEditingName) onEditingChange?.(activity.id, false);
		};
	}, [activity.id, isEditingName, onEditingChange]);

	const startEditing = useCallback(() => {
		setDraft(activity.name);
		setIsEditingName(true);
	}, [activity.name]);

	const cancelEditing = useCallback(() => {
		setDraft(activity.name);
		setIsEditingName(false);
	}, [activity.name]);

	const commit = useCallback(async () => {
		const trimmed = draft.trim();
		if (!trimmed || trimmed === activity.name) {
			cancelEditing();
			return;
		}
		setBusy(true);
		try {
			await onRename(activity.id, trimmed);
			setIsEditingName(false);
		}
		finally {
			setBusy(false);
		}
	}, [activity.id, activity.name, cancelEditing, draft, onRename]);

	const onKey = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				void commit();
			}
			else if (event.key === 'Escape') {
				event.preventDefault();
				cancelEditing();
			}
		},
		[cancelEditing, commit],
	);

	const handleFeedback = useCallback(
		async (action: FeedbackAction): Promise<void> => {
			setBusy(true);
			try {
				await onFeedback(activity.id, action);
			}
			finally {
				setBusy(false);
			}
		},
		[activity.id, onFeedback],
	);

	const handleDelete = useCallback(async (): Promise<void> => {
		if (!window.confirm(`Delete "${activity.name}"?`)) return;
		setBusy(true);
		try {
			await onDelete(activity.id);
		}
		finally {
			setBusy(false);
		}
	}, [activity.id, activity.name, onDelete]);

	/* --- Tag callbacks --- */

	const handleAddTag = useCallback(
		async (tagName: string) => {
			const current = activity.tags ?? [];
			if (current.includes(tagName)) return; // already on this activity
			await onUpdateTags(activity.id, [...current, tagName]);
		},
		[activity.id, activity.tags, onUpdateTags],
	);

	const handleRemoveTag = useCallback(
		async (tagName: string) => {
			const current = activity.tags ?? [];
			await onUpdateTags(
				activity.id,
				current.filter((tag) => tag !== tagName),
			);
		},
		[activity.id, activity.tags, onUpdateTags],
	);

	const handleSetTagColor = useCallback(
		async (tagName: string, color: string | null) => {
			await onSetTagColor(tagName, color);
		},
		[onSetTagColor],
	);

	const tags = activity.tags ?? [];

	if (isCompact) {
		return (
			<li
				className={`activity-row is-compact${isSelected ? ' is-selected' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
				onMouseEnter={() => onRowMouseEnter(activity.id)}
				onMouseDown={(event) => {
					if (!isSelectMode) return;
					const target = event.target as HTMLElement;
					if (
						target.closest('.activity-row-selector') ||
						target.closest('.activity-row-feedback') ||
						target.closest('.activity-row-edit')
					)
						return;
					event.preventDefault();
					onSelectionMouseDown(activity.id);
				}}
			>
				<div
					className="activity-row-selector"
					role="checkbox"
					aria-checked={isSelected}
					aria-label={`Select ${activity.name}`}
					tabIndex={-1}
					onMouseDown={(event) => {
						event.stopPropagation();
						event.preventDefault();
						onSelectionMouseDown(activity.id);
					}}
				>
					<div className="activity-row-selector-circle">{isSelected && <CheckIcon />}</div>
				</div>
				<div className={`activity-row-body`}>
					{isEditingName ? (
						<input
							ref={inputRef}
							type="text"
							className="activity-row-edit"
							value={draft}
							onChange={(event) => setDraft(event.target.value)}
							onKeyDown={onKey}
							onBlur={() => void commit()}
							disabled={busy}
							maxLength={120}
						/>
					) : (
						<button
							type="button"
							className="activity-row-name"
							onClick={() => {
								if (!isSelectMode) startEditing();
							}}
							title={isSelectMode ? undefined : 'Click to rename'}
						>
							{activity.name}
						</button>
					)}
					{showWeights && (
						<span
							className="meta-pill"
							style={getBarPillStyle(effectiveWeight, weightMinimum, weightMaximum)}
							title="Effective weight = stored weight + recency boost"
						>
							w {formatWeight(effectiveWeight)}
						</span>
					)}
					{showProbabilities && probability !== null && (
						<span
							className="meta-pill"
							style={getBarPillStyle(probability, probabilityMinimum, probabilityMaximum)}
							title="Selection probability if you spin right now"
						>
							p {formatPercent(probability)}
						</span>
					)}
					<div className="activity-row-feedback">
						<button
							type="button"
							className="icon-btn icon-btn-love-it"
							onClick={() => void handleFeedback('boost')}
							disabled={busy}
							title="Love It! (big weight boost)"
							aria-label="Love It!"
						>
							★
						</button>
						<button
							type="button"
							className="icon-btn"
							onClick={() => void handleFeedback('accept')}
							disabled={busy}
							title="Increase enjoyment"
							aria-label="Increase enjoyment"
						>
							+
						</button>
						<button
							type="button"
							className="icon-btn"
							onClick={() => void handleFeedback('reject')}
							disabled={busy}
							title="Decrease enjoyment"
							aria-label="Decrease enjoyment"
						>
							−
						</button>
						<button
							type="button"
							className="icon-btn icon-btn-hate-it"
							onClick={() => void handleFeedback('hate')}
							disabled={busy}
							title="Hate It! (big weight penalty)"
							aria-label="Hate It!"
						>
							✕
						</button>
						<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
					</div>
				</div>
			</li>
		);
	}

	return (
		<li
			className={`activity-row${isSelected ? ' is-selected' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
			onMouseEnter={() => onRowMouseEnter(activity.id)}
			onMouseDown={(event) => {
				if (!isSelectMode) return;
				const target = event.target as HTMLElement;
				if (
					target.closest('.activity-row-selector') ||
					target.closest('.activity-row-feedback') ||
					target.closest('.activity-row-tags') ||
					target.closest('.activity-tag-add') ||
					target.closest('.activity-row-edit')
				)
					return;
				event.preventDefault();
				onSelectionMouseDown(activity.id);
			}}
		>
			<div
				className="activity-row-selector"
				role="checkbox"
				aria-checked={isSelected}
				aria-label={`Select ${activity.name}`}
				tabIndex={-1}
				onMouseDown={(event) => {
					event.stopPropagation();
					event.preventDefault();
					onSelectionMouseDown(activity.id);
				}}
			>
				<div className="activity-row-selector-circle">{isSelected && <CheckIcon />}</div>
			</div>
			<div className="activity-row-body">
				{/* Top row: name (+ inline add-tag when empty) | feedback buttons */}
				<div className="activity-row-top">
					<div className="activity-row-name-area">
						{isEditingName ? (
							<input
								ref={inputRef}
								type="text"
								className="activity-row-edit"
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								onKeyDown={onKey}
								onBlur={() => void commit()}
								disabled={busy}
								maxLength={120}
							/>
						) : (
							<button
								type="button"
								className="activity-row-name"
								onClick={() => {
									if (!isSelectMode) startEditing();
								}}
								title={isSelectMode ? undefined : 'Click to rename'}
							>
								{activity.name}
							</button>
						)}
						{!isEditingName && (
							<div className="activity-row-meta">
								<span title={`Added ${formatDate(activity.createdAt)}`}>
									{formatDate(activity.createdAt)}
								</span>
								{(showWeights || (showProbabilities && probability !== null)) && (
									<span className="activity-row-pills">
										{showWeights && (
											<span
												className="meta-pill"
												style={getBarPillStyle(effectiveWeight, weightMinimum, weightMaximum)}
												title="Effective weight = stored weight + recency boost"
											>
												w {formatWeight(effectiveWeight)}
											</span>
										)}
										{showProbabilities && probability !== null && (
											<span
												className="meta-pill"
												style={getBarPillStyle(probability, probabilityMinimum, probabilityMaximum)}
												title="Selection probability if you spin right now"
											>
												p {formatPercent(probability)}
											</span>
										)}
									</span>
								)}
							</div>
						)}
						{!hasTags && !isEditingName && (
							<AddTagCombobox
								activityTags={tags}
								allTagMetadata={allTagMetadata}
								onAdd={(name) => void handleAddTag(name)}
							/>
						)}
					</div>

					<div className="activity-row-feedback">
						<button
							type="button"
							className="icon-btn icon-btn-love-it"
							onClick={() => void handleFeedback('boost')}
							disabled={busy}
							title="Love It! (big weight boost)"
							aria-label="Love It! (big weight boost)"
						>
							★
						</button>
						<button
							type="button"
							className="icon-btn"
							onClick={() => void handleFeedback('accept')}
							disabled={busy}
							title="Increase enjoyment"
							aria-label="Increase enjoyment"
						>
							+
						</button>
						<button
							type="button"
							className="icon-btn"
							onClick={() => void handleFeedback('reject')}
							disabled={busy}
							title="Decrease enjoyment"
							aria-label="Decrease enjoyment"
						>
							−
						</button>
						<button
							type="button"
							className="icon-btn icon-btn-hate-it"
							onClick={() => void handleFeedback('hate')}
							disabled={busy}
							title="Hate It! (big weight penalty)"
							aria-label="Hate It!"
						>
							✕
						</button>
						<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
					</div>
				</div>

				{/* Tags row. Only rendered when the activity has tags */}
				{hasTags && (
					<div className="activity-row-tags">
						{tags.map((tag) => {
							const matchedMetadata = allTagMetadata.find((metadata) => metadata.name === tag);
							return (
								<TagPill
									key={tag}
									name={tag}
									color={matchedMetadata?.color}
									count={tagCounts.get(tag) ?? 1}
									onRemove={() => void handleRemoveTag(tag)}
									onSetColor={(color) => void handleSetTagColor(tag, color)}
								/>
							);
						})}
						<AddTagCombobox
							activityTags={tags}
							allTagMetadata={allTagMetadata}
							onAdd={(name) => void handleAddTag(name)}
						/>
					</div>
				)}
			</div>
		</li>
	);
}

export const ActivityRow = memo(ActivityRowComponent);
