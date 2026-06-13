/**
 * One row in the activity list. Supports:
 *  - Inline editing of the name (Enter to save, Esc to cancel).
 *  - Manual feedback buttons (= same as accept/reject from the wheel).
 *  - Delete.
 *  - Tag pills: display, add (combobox), remove (✕ on hover), color-pick (right-click).
 *
 * Pure presentation: actual persistence is done by the parent's callbacks.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import type { Activity, FeedbackAction, TagMetadata } from '../domain-logic/types';
import { getEffectiveWeight, isLowWeight } from '../domain-logic/weight-logic';
import { formatDate, formatPercent, formatWeight } from '../utils/format';
import { useWeightContext } from '../context/WeightContext';
import { useNow } from '../hooks/useNow';

/* ------------------------------------------------------------------ */
/* Tag color presets                                                   */
/* ------------------------------------------------------------------ */

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
      <line x1="6" y1="7" x2="6" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10" y1="7" x2="10" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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

const TAG_COLOR_PRESETS = [
  { color: '#ef4444', label: 'Red' },
  { color: '#f97316', label: 'Orange' },
  { color: '#f59e0b', label: 'Amber' },
  { color: '#22c55e', label: 'Green' },
  { color: '#06b6d4', label: 'Cyan' },
  { color: '#3b82f6', label: 'Blue' },
  { color: '#8b5cf6', label: 'Purple' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#6b7280', label: 'Gray' },
];

/* ------------------------------------------------------------------ */
/* TagPill — individual tag on a row                                   */
/* ------------------------------------------------------------------ */

interface TagPillProps {
  name: string;
  color?: string;
  count: number;
  onRemove(): void;
  onSetColor(color: string | null): void;
}

function TagPill({ name, color, count, onRemove, onSetColor }: TagPillProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
  const pillRef = useRef<HTMLSpanElement>(null);
  const customColorRef = useRef<HTMLInputElement>(null);

  const openColorPicker = useCallback((e: MouseEvent) => {
    e.preventDefault();
    if (pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      setPickerPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
    setColorPickerOpen(true);
  }, []);

  const closeColorPicker = useCallback(() => setColorPickerOpen(false), []);

  // Close picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tag-color-picker')) {
        closeColorPicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen, closeColorPicker]);

  const pillStyle: CSSProperties = color
    ? { borderColor: color, color: color }
    : {};

  return (
    <>
      <span
        ref={pillRef}
        className="activity-tag-pill"
        style={pillStyle}
        onContextMenu={openColorPicker}
        title={`${name} — right-click to change color`}
      >
        {name}
        <span className="activity-tag-pill-suffix">
          <span className="activity-tag-count">{count}</span>
          <button
            type="button"
            className="activity-tag-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`Remove tag "${name}"`}
            tabIndex={-1}
          >
            ✕
          </button>
        </span>
      </span>

      {colorPickerOpen && createPortal(
        <div
          className="tag-color-picker"
          style={{ position: 'absolute', top: pickerPos.top, left: pickerPos.left }}
          role="dialog"
          aria-label={`Color picker for tag "${name}"`}
        >
          <div className="tag-color-picker-label">Color for "{name}"</div>
          <div className="tag-color-presets">
            {TAG_COLOR_PRESETS.map((p) => (
              <button
                key={p.color}
                type="button"
                className={`tag-color-swatch${color === p.color ? ' tag-color-swatch-active' : ''}`}
                style={{ backgroundColor: p.color }}
                title={p.label}
                onClick={() => { onSetColor(p.color); closeColorPicker(); }}
                aria-label={p.label}
              />
            ))}
          </div>
          <div className="tag-color-picker-actions">
            <label className="tag-color-custom-label">
              Custom:
              <input
                ref={customColorRef}
                type="color"
                className="tag-color-custom-input"
                defaultValue={color ?? '#3b82f6'}
                onChange={(e) => onSetColor(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => { onSetColor(null); closeColorPicker(); }}
            >
              Remove color
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* AddTagCombobox — the ＋ pill + dropdown                             */
/* ------------------------------------------------------------------ */

interface AddTagComboboxProps {
  activityTags: string[];
  allTagMetadata: readonly TagMetadata[];
  onAdd(name: string): void;
  /** When provided, renders a full button instead of the ＋ pill. */
  triggerLabel?: string;
}

export function AddTagCombobox({ activityTags, allTagMetadata, onAdd, triggerLabel }: AddTagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 220 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const openCombobox = useCallback(() => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: 220,
      });
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
    const handler = (e: globalThis.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.tag-combobox-dropdown') && !(btnRef.current?.contains(target) ?? false)) {
        closeCombobox();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeCombobox]);

  const suggestions = (() => {
    const q = query.trim().toLowerCase();
    return allTagMetadata
      .map((t) => t.name)
      .filter((name) => !activityTags.includes(name)) // exclude already-added
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 12);
  })();

  const queryTrimmed = query.trim();
  const exactMatch = allTagMetadata.some(
    (t) => t.name.toLowerCase() === queryTrimmed.toLowerCase(),
  );
  const showCreate = queryTrimmed.length > 0 && !exactMatch;

  const confirm = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    closeCombobox();
  }, [onAdd, closeCombobox]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (suggestions.length === 1) {
          confirm(suggestions[0]);
        } else if (queryTrimmed) {
          confirm(queryTrimmed);
        }
      } else if (e.key === 'Escape') {
        closeCombobox();
      }
    },
    [closeCombobox, confirm, queryTrimmed, suggestions],
  );

  return (
    <>
      {triggerLabel ? (
        <button
          ref={btnRef}
          type="button"
          className="btn btn-ghost btn-small"
          onClick={openCombobox}
          aria-label={triggerLabel}
        >
          {triggerLabel}
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          className="activity-tag-add"
          onClick={openCombobox}
          title="Add a tag"
          aria-label="Add a tag"
        >
          ＋
        </button>
      )}

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="tag-combobox-dropdown"
          style={{
            position: 'absolute',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            maxLength={60}
            autoComplete="off"
          />
          <ul className="tag-combobox-list" role="listbox">
            {suggestions.length === 0 && !showCreate && (
              <li className="tag-combobox-empty">
                {queryTrimmed ? `No existing tags match "${queryTrimmed}"` : 'No other tags yet — type to create one'}
              </li>
            )}
            {suggestions.map((name) => (
              <li
                key={name}
                className="tag-combobox-option"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); confirm(name); }}
              >
                {name}
              </li>
            ))}
            {showCreate && (
              <li
                className="tag-combobox-option tag-combobox-create"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); confirm(queryTrimmed); }}
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

/* ------------------------------------------------------------------ */
/* ActivityRow props                                                   */
/* ------------------------------------------------------------------ */

interface Props {
  readonly activity: Activity;
  readonly probability: number | null;
  readonly showWeights: boolean;
  readonly showProbabilities: boolean;
  readonly weightMin: number;
  readonly weightMax: number;
  readonly probMin: number;
  readonly probMax: number;
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
}

/** Returns a linear-gradient pill style that shows a bar-chart fill colored
 *  red (lowest) → amber (middle) → green (highest), matching --hate / --warn
 *  / --good, based on the value's position within the provided min/max range. */
function getBarPillStyle(value: number, min: number, max: number): CSSProperties {
  const range = max - min;
  const t = range === 0 ? 1 : Math.max(0, Math.min(1, (value - min) / range));

  let r: number, g: number, b: number;
  if (t <= 0.5) {
    const s = t * 2;
    r = Math.round(201 + (240 - 201) * s);
    g = Math.round(42 + (140 - 42) * s);
    b = Math.round(42 + (0 - 42) * s);
  } else {
    const s = (t - 0.5) * 2;
    r = Math.round(240 + (55 - 240) * s);
    g = Math.round(140 + (178 - 140) * s);
    b = Math.round(0 + (77 - 0) * s);
  }

  const fillPct = 5 + t * 95;
  const fillColor = `rgba(${r}, ${g}, ${b}, 0.55)`;
  const borderColor = `rgb(${r}, ${g}, ${b})`;

  return {
    background: `linear-gradient(to right, ${fillColor} ${fillPct}%, var(--bg-soft) ${fillPct}%)`,
    borderColor,
  };
}

/* ------------------------------------------------------------------ */
/* ActivityRow                                                         */
/* ------------------------------------------------------------------ */

function ActivityRowComponent({
  activity,
  probability,
  showWeights,
  showProbabilities,
  weightMin,
  weightMax,
  probMin,
  probMax,
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
}: Props) {
  const globalWeightContext = useWeightContext();
  const now = useNow();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveWeight = getEffectiveWeight(activity, now, globalWeightContext);
  const low = isLowWeight(activity, now, globalWeightContext);
	const hasTags = (activity.tags ?? []).length > 0;

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

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
    } finally {
      setBusy(false);
    }
  }, [activity.id, activity.name, cancelEditing, draft, onRename]);

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
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
      } finally {
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
    } finally {
      setBusy(false);
    }
  }, [activity.id, activity.name, onDelete]);

  /* --- Tag callbacks --- */

  const handleAddTag = useCallback(async (tagName: string) => {
    const current = activity.tags ?? [];
    if (current.includes(tagName)) return; // already on this activity
    await onUpdateTags(activity.id, [...current, tagName]);
  }, [activity.id, activity.tags, onUpdateTags]);

  const handleRemoveTag = useCallback(async (tagName: string) => {
    const current = activity.tags ?? [];
    await onUpdateTags(activity.id, current.filter((t) => t !== tagName));
  }, [activity.id, activity.tags, onUpdateTags]);

  const handleSetTagColor = useCallback(async (tagName: string, color: string | null) => {
    await onSetTagColor(tagName, color);
  }, [onSetTagColor]);

  const tags = activity.tags ?? [];

  if (isCompact) {
    return (
      <li
        className={`activity-row is-compact${low ? ' is-low' : ''}${isSelected ? ' is-selected' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
        onMouseEnter={() => onRowMouseEnter(activity.id)}
        onMouseDown={(e) => {
          if (!isSelectMode) return;
          const target = e.target as HTMLElement;
          if (target.closest('.activity-row-selector') ||
              target.closest('.activity-row-feedback') ||
              target.closest('.activity-row-edit')) return;
          e.preventDefault();
          onSelectionMouseDown(activity.id);
        }}
      >
        <div
          className="activity-row-selector"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select ${activity.name}`}
          tabIndex={-1}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSelectionMouseDown(activity.id);
          }}
        >
          <div className="activity-row-selector-circle">
            {isSelected && <CheckIcon />}
          </div>
        </div>
        <div className={`activity-row-body`}>
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              className="activity-row-edit"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              onBlur={() => void commit()}
              disabled={busy}
              maxLength={120}
            />
          ) : (
            <button
              type="button"
              className="activity-row-name"
              onClick={() => { if (!isSelectMode) startEditing(); }}
              title={isSelectMode ? undefined : 'Click to rename'}
            >
              {activity.name}
              {low && <span className="activity-row-warn" title="Low weight">⚠</span>}
            </button>
          )}
          {showWeights && (
            <span
              className="meta-pill"
              style={getBarPillStyle(effectiveWeight, weightMin, weightMax)}
              title="Effective weight = stored weight + recency boost"
            >
              w {formatWeight(effectiveWeight)}
            </span>
          )}
          <div className="activity-row-feedback">
            <button
              type="button"
              className="icon-btn icon-btn-super-fun"
              onClick={() => void handleFeedback('boost')}
              disabled={busy}
              title="Super Fun! — big weight boost"
              aria-label="Super Fun!"
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
              title="Hate It! — big weight penalty"
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
      className={`activity-row${low ? ' is-low' : ''}${isSelected ? ' is-selected' : ''}${isSelectMode ? ' is-select-mode' : ''}`}
      onMouseEnter={() => onRowMouseEnter(activity.id)}
      onMouseDown={(e) => {
        if (!isSelectMode) return;
        const target = e.target as HTMLElement;
        if (target.closest('.activity-row-selector') ||
            target.closest('.activity-row-feedback') ||
            target.closest('.activity-row-bottom') ||
            target.closest('.activity-row-tags') ||
            target.closest('.activity-tag-add') ||
            target.closest('.activity-row-edit')) return;
        e.preventDefault();
        onSelectionMouseDown(activity.id);
      }}
    >
      <div
        className="activity-row-selector"
        role="checkbox"
        aria-checked={isSelected}
        aria-label={`Select ${activity.name}`}
        tabIndex={-1}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSelectionMouseDown(activity.id);
        }}
      >
        <div className="activity-row-selector-circle">
          {isSelected && <CheckIcon />}
        </div>
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
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                onBlur={() => void commit()}
                disabled={busy}
                maxLength={120}
              />
            ) : (
              <button
                type="button"
                className="activity-row-name"
                onClick={() => { if (!isSelectMode) startEditing(); }}
                title={isSelectMode ? undefined : 'Click to rename'}
              >
                {activity.name}
                {low && (
                  <span className="activity-row-warn" title="Low weight — consider deleting">
                    ⚠
                  </span>
                )}
              </button>
            )}
						{!isEditingName && (
							<div className="activity-row-meta">
								<span title={`Added ${formatDate(activity.createdAt)}`}>
									{formatDate(activity.createdAt)}
								</span>
								{showWeights && (
									<span
										className="meta-pill"
										style={getBarPillStyle(effectiveWeight, weightMin, weightMax)}
										title="Effective weight = stored weight + recency boost"
									>
										w {formatWeight(effectiveWeight)}
									</span>
								)}
								{showProbabilities && probability !== null && (
									<span
										className="meta-pill"
										style={getBarPillStyle(probability, probMin, probMax)}
										title="Selection probability if you spin right now"
									>
										p {formatPercent(probability)}
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
              className="icon-btn icon-btn-super-fun"
              onClick={() => void handleFeedback('boost')}
              disabled={busy}
              title="Super Fun! — big weight boost"
              aria-label="Super Fun! — big weight boost"
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
              title="Hate It! — big weight penalty"
              aria-label="Hate It!"
            >
              ✕
            </button>
						{!hasTags && (
							<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
						)}
          </div>
        </div>

        {/* Tags row — only rendered when the activity has tags */}
        {hasTags && (
					<div className="activity-row-bottom">
						<div className="activity-row-tags">
							{tags.map((tag) => {
								const meta = allTagMetadata.find((m) => m.name === tag);
								return (
									<TagPill
										key={tag}
										name={tag}
										color={meta?.color}
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
						<DeleteButton onClick={() => void handleDelete()} disabled={busy} />
					</div>
        )}
      </div>
    </li>
  );
}

export const ActivityRow = memo(ActivityRowComponent);
