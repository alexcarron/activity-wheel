/**
 * Reusable color/rename popover for a tag. Used by any tag pill that lets the user edit a tag: activity-row tag pills and tag-filter-bar pills.
 */

import { createPortal } from 'react-dom';
import { useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import { TAG_COLOR_PRESETS } from '../constants/tag-colors';
import { toErrorMessage } from '../utils/error-message';
import './TagColorPicker.css';

interface TagColorPickerPopoverProps {
	tagName: string;
	color?: string;
	position: { top: number; left: number };
	popoverRef: RefObject<HTMLDivElement | null>;
	onSetColor(color: string | null): void;
	onRename(newName: string): Promise<void>;
	onDelete(): Promise<void>;
	onClose(): void;
}

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

export function TagColorPickerPopover({
	tagName,
	color,
	position,
	popoverRef,
	onSetColor,
	onRename,
	onDelete,
	onClose,
}: TagColorPickerPopoverProps) {
	const [draftName, setDraftName] = useState(tagName);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const handleDelete = async (): Promise<void> => {
		if (!window.confirm(`Delete tag "${tagName}"? This removes it from every activity.`)) return;
		await onDelete();
		onClose();
	};

	const commitRename = async (): Promise<void> => {
		const trimmed = draftName.trim();
		if (!trimmed || trimmed === tagName) {
			setDraftName(tagName);
			setErrorMessage(null);
			return;
		}
		try {
			await onRename(trimmed);
			setErrorMessage(null);
		}
		catch (error) {
			setDraftName(trimmed);
			setErrorMessage(toErrorMessage(error));
		}
	};

	const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename();
		}
		else if (event.key === 'Escape') {
			event.preventDefault();
			setDraftName(tagName);
			setErrorMessage(null);
			event.currentTarget.blur();
		}
	};

	return createPortal(
		<div
			ref={popoverRef}
			className="tag-color-picker"
			style={{ position: 'absolute', top: position.top, left: position.left }}
			role="dialog"
			aria-label={`Edit tag "${tagName}"`}
		>
			<div className="tag-color-picker-header">
				<input
					type="text"
					className="tag-color-picker-name-input"
					value={draftName}
					onChange={(event) => setDraftName(event.target.value)}
					onKeyDown={onNameKeyDown}
					onBlur={() => void commitRename()}
					maxLength={60}
					aria-label="Tag name"
				/>
				<button
					type="button"
					className="tag-color-picker-delete"
					onClick={() => void handleDelete()}
					title="Delete tag"
					aria-label="Delete tag"
				>
					<TrashIcon />
				</button>
			</div>
			{errorMessage && <div className="tag-color-picker-name-error">{errorMessage}</div>}
			<div className="tag-color-presets">
				{TAG_COLOR_PRESETS.map((preset) => (
					<button
						key={preset.color}
						type="button"
						className={`tag-color-swatch${color === preset.color ? ' tag-color-swatch-active' : ''}`}
						style={{ backgroundColor: preset.color }}
						title={preset.label}
						onClick={() => {
							onSetColor(preset.color);
							onClose();
						}}
						aria-label={preset.label}
					/>
				))}
			</div>
			<div className="tag-color-picker-actions">
				<label className="tag-color-custom-label">
					Custom:
					<input
						type="color"
						className="tag-color-custom-input"
						defaultValue={color ?? '#3b82f6'}
						onChange={(event) => onSetColor(event.target.value)}
					/>
				</label>
				<button
					type="button"
					className="btn btn-ghost btn-small"
					onClick={() => {
						onSetColor(null);
						onClose();
					}}
				>
					Remove color
				</button>
			</div>
		</div>,
		document.body,
	);
}
