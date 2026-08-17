import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../../../domain-logic/types';
import { formatDate, formatCompactDate } from '../../../utils/format';
import { DEBUG_VALUE_PILL_KEYS, type DebugValuePillKey, type DebugValuePillRange } from '../../reusable/debug-value-pills';
import { DebugValuePills } from '../../reusable/DebugValuePills';
import { clampToViewport } from '../../../utils/clamp-to-viewport';
import { useTagColorPickerPopover } from '../../../hooks/useTagColorPickerPopover';
import { TagColorPickerPopover } from '../../reusable/TagColorPicker';
import { TrashIcon } from '../../svg-icons/TrashIcon';
import { CheckIcon } from '../../svg-icons/CheckIcon';
import { HeartIcon } from '../../svg-icons/HeartIcon';
import { BrokenHeartIcon } from '../../svg-icons/BrokenHeartIcon';
import { ThumbsUpIcon } from '../../svg-icons/ThumbsUpIcon';
import { ThumbsDownIcon } from '../../svg-icons/ThumbsDownIcon';
import './ActivityRow.css';

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
	onRename(newName: string): Promise<void>;
	onDelete(): Promise<void>;
}

function TagPill({ name, color, count, onRemove, onSetColor, onRename, onDelete }: TagPillProps) {
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
				title={`${name} (click to edit)`}
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
					onRename={onRename}
					onDelete={onDelete}
					onClose={close}
				/>
			)}
		</>
	);
}

interface AddTagComboboxProps {
	activityTagIDs: string[];
	allTagMetadata: readonly TagMetadata[];
	onAdd(name: string): void;
	/** When provided, renders a full button instead of the ＋ pill. */
	triggerLabel?: string;
}

export function AddTagCombobox({
	activityTagIDs,
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
			.filter((tag) => !activityTagIDs.includes(tag.id)) // exclude already-added
			.map((tag) => tag.name)
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
	/** Values for every debug pill for this activity, or null when no pill is shown. */
	readonly debugValues: Record<DebugValuePillKey, number> | null;
	/** Min/max of each debug value across the shown activities, for the pill bar coloring. */
	readonly debugRanges: Record<DebugValuePillKey, DebugValuePillRange>;
	/** Which debug value pills are currently shown. */
	readonly debugValuePillKeyToIsVisible: Record<DebugValuePillKey, boolean>;
	readonly allTagMetadata: readonly TagMetadata[];
	readonly tagCounts: ReadonlyMap<string, number>;
	readonly isCompact?: boolean;
	readonly isShowingTags: boolean;
	readonly isShowingDateAdded: boolean;
	readonly now: number;
	readonly isSelected: boolean;
	readonly isSelectMode: boolean;
	onRename(id: string, name: string): Promise<void>;
	onFeedback(id: string, action: FeedbackAction): Promise<void>;
	onDelete(id: string): Promise<void>;
	onUpdateTags(id: string, tagIds: string[]): Promise<void>;
	onAddTag(id: string, tagName: string): Promise<void>;
	onSetTagColor(tagID: string, color: string | null): Promise<void>;
	onRenameTag(tagID: string, newName: string): Promise<void>;
	onDeleteTag(tagID: string): Promise<void>;
	onSelectionMouseDown(id: string): void;
	onRowMouseEnter(id: string): void;
	/** Called whenever this row's inline rename editor opens/closes. Used to detect confusing remote changes to a shared wheel while a name edit is in progress. */
	onEditingChange?(activityID: string, isEditing: boolean): void;
}

function ActivityRowComponent({
	activity,
	debugValues,
	debugRanges,
	debugValuePillKeyToIsVisible,
	allTagMetadata,
	tagCounts,
	isCompact = false,
	isShowingTags,
	isShowingDateAdded,
	now,
	isSelected,
	isSelectMode,
	onRename,
	onFeedback,
	onDelete,
	onUpdateTags,
	onAddTag,
	onSetTagColor,
	onRenameTag,
	onDeleteTag,
	onSelectionMouseDown,
	onRowMouseEnter,
	onEditingChange,
}: Props) {
	const [isEditingName, setIsEditingName] = useState(false);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const hasTags = (activity.tagIds ?? []).length > 0;
	const hasVisibleDebugPills = debugValues !== null && DEBUG_VALUE_PILL_KEYS.some((key) => debugValuePillKeyToIsVisible[key]);

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
		(action: FeedbackAction): void => {
			void onFeedback(activity.id, action);
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
			await onAddTag(activity.id, tagName);
		},
		[activity.id, onAddTag],
	);

	const handleRemoveTag = useCallback(
		async (tagID: string) => {
			const current = activity.tagIds ?? [];
			await onUpdateTags(
				activity.id,
				current.filter((id) => id !== tagID),
			);
		},
		[activity.id, activity.tagIds, onUpdateTags],
	);

	const handleSetTagColor = useCallback(
		async (tagID: string, color: string | null) => {
			await onSetTagColor(tagID, color);
		},
		[onSetTagColor],
	);

	const handleRenameTag = useCallback(
		async (tagID: string, newName: string) => {
			await onRenameTag(tagID, newName);
		},
		[onRenameTag],
	);

	const handleDeleteTag = useCallback(
		async (tagID: string) => {
			await onDeleteTag(tagID);
		},
		[onDeleteTag],
	);

	const tagIds = activity.tagIds ?? [];

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
					<div className="activity-row-top">
						<div className="activity-row-compact-primary">
							<div className={`activity-row-compact-fields${isEditingName ? ' is-editing' : ''}`}>
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
								{!isEditingName && isShowingDateAdded && (
									<span className="activity-row-compact-date" title={`Added ${formatDate(activity.createdAt)}`}>
										{formatCompactDate(activity.createdAt, now)}
									</span>
								)}
							</div>
							{!isEditingName &&
								(isShowingTags ? (
									<div className="activity-row-compact-tags">
										{tagIds.map((tagID) => {
											const tagMetadata = allTagMetadata.find((tag) => tag.id === tagID);
											if (!tagMetadata) return null;
											return (
												<TagPill
													key={tagID}
													name={tagMetadata.name}
													color={tagMetadata.color}
													count={tagCounts.get(tagID) ?? 1}
													onRemove={() => void handleRemoveTag(tagID)}
													onSetColor={(color) => void handleSetTagColor(tagID, color)}
													onRename={(newName) => handleRenameTag(tagID, newName)}
													onDelete={() => handleDeleteTag(tagID)}
												/>
											);
										})}
										<AddTagCombobox
											activityTagIDs={tagIds}
											allTagMetadata={allTagMetadata}
											onAdd={(name) => void handleAddTag(name)}
										/>
									</div>
								) : (
									<span className="activity-row-compact-spacer" />
								))}
							{hasVisibleDebugPills && (
								<span className="activity-row-pills">
									<DebugValuePills values={debugValues} ranges={debugRanges} visibility={debugValuePillKeyToIsVisible} />
								</span>
							)}
						</div>
						<div className="activity-row-feedback">
							<button
								type="button"
								className="icon-btn icon-btn-love-it"
								onClick={() => handleFeedback('boost')}
								title="Love It! (big weight boost)"
								aria-label="Love It!"
							>
								<HeartIcon />
							</button>
							<button
								type="button"
								className="icon-btn icon-btn-accept"
								onClick={() => handleFeedback('accept')}
								title="Increase enjoyment"
								aria-label="Increase enjoyment"
							>
								<ThumbsUpIcon />
							</button>
							<button
								type="button"
								className="icon-btn icon-btn-reject"
								onClick={() => handleFeedback('reject')}
								title="Decrease enjoyment"
								aria-label="Decrease enjoyment"
							>
								<ThumbsDownIcon />
							</button>
							<button
								type="button"
								className="icon-btn icon-btn-hate-it"
								onClick={() => handleFeedback('hate')}
								title="Hate It! (big weight penalty)"
								aria-label="Hate It!"
							>
								<BrokenHeartIcon />
							</button>
							<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
						</div>
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
						{!isEditingName && isShowingDateAdded && (
							<span className="activity-row-date" title={`Added ${formatDate(activity.createdAt)}`}>
								{formatDate(activity.createdAt)}
							</span>
						)}
						{!hasTags && !isEditingName && isShowingTags && (
							<AddTagCombobox
								activityTagIDs={tagIds}
								allTagMetadata={allTagMetadata}
								onAdd={(name) => void handleAddTag(name)}
							/>
						)}
					</div>

					{hasVisibleDebugPills && (
						<span className="activity-row-pills">
							<DebugValuePills values={debugValues} ranges={debugRanges} visibility={debugValuePillKeyToIsVisible} />
						</span>
					)}

					<div className="activity-row-feedback">
						<button
							type="button"
							className="icon-btn icon-btn-love-it"
							onClick={() => handleFeedback('boost')}
							title="Love It! (big weight boost)"
							aria-label="Love It! (big weight boost)"
						>
							<HeartIcon />
						</button>
						<button
							type="button"
							className="icon-btn icon-btn-accept"
							onClick={() => handleFeedback('accept')}
							title="Increase enjoyment"
							aria-label="Increase enjoyment"
						>
							<ThumbsUpIcon />
						</button>
						<button
							type="button"
							className="icon-btn icon-btn-reject"
							onClick={() => handleFeedback('reject')}
							title="Decrease enjoyment"
							aria-label="Decrease enjoyment"
						>
							<ThumbsDownIcon />
						</button>
						<button
							type="button"
							className="icon-btn icon-btn-hate-it"
							onClick={() => handleFeedback('hate')}
							title="Hate It! (big weight penalty)"
							aria-label="Hate It!"
						>
							<BrokenHeartIcon />
						</button>
						<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
					</div>
				</div>

				{hasTags && isShowingTags && (
					<div className="activity-row-tags">
						{tagIds.map((tagID) => {
							const metadata = allTagMetadata.find((tag) => tag.id === tagID);
							if (!metadata) return null;
							return (
								<TagPill
									key={tagID}
									name={metadata.name}
									color={metadata.color}
									count={tagCounts.get(tagID) ?? 1}
									onRemove={() => void handleRemoveTag(tagID)}
									onSetColor={(color) => void handleSetTagColor(tagID, color)}
									onRename={(newName) => handleRenameTag(tagID, newName)}
									onDelete={() => handleDeleteTag(tagID)}
								/>
							);
						})}
						<AddTagCombobox
							activityTagIDs={tagIds}
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
