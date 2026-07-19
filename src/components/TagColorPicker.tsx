/**
 * Reusable color-picker popover for a tag. Used by any tag pill that lets the user pick a color: activity-row tag pills and tag-filter-bar pills.
 */

import { createPortal } from 'react-dom';
import type { RefObject } from 'react';
import { TAG_COLOR_PRESETS } from '../constants/tag-colors';
import './TagColorPicker.css';

interface TagColorPickerPopoverProps {
	tagName: string;
	color?: string;
	position: { top: number; left: number };
	popoverRef: RefObject<HTMLDivElement | null>;
	onSetColor(color: string | null): void;
	onClose(): void;
}

export function TagColorPickerPopover({
	tagName,
	color,
	position,
	popoverRef,
	onSetColor,
	onClose,
}: TagColorPickerPopoverProps) {
	return createPortal(
		<div
			ref={popoverRef}
			className="tag-color-picker"
			style={{ position: 'absolute', top: position.top, left: position.left }}
			role="dialog"
			aria-label={`Color picker for tag "${tagName}"`}
		>
			<div className="tag-color-picker-label">Color for "{tagName}"</div>
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
