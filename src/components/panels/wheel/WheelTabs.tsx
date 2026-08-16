/**
 * WheelTabs. Tab bar for switching between named wheels.
 * UI rules:
 * - Active tab is highlighted.
 * - Double-click a tab name to rename it inline.
 * - Hover a tab to reveal the × delete button (only when 2+ wheels).
 * - The + button opens an inline creation form below the tabs.
 * - [ / ] hotkeys cycle wheels (managed by useWheels, shown as hints here). 
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Wheel } from '../../../domain-logic/types';
import { SharedWheelIcon } from '../../reusable/svg-icons/SharedWheelIcon';
import './WheelTabs.css';

interface Props {
	wheels: readonly Wheel[];
	activeWheelID: string;
	onSwitch(id: string): void;
	onCreate(name: string, fromWheelID: string | null, resetWeights: boolean): Promise<void>;
	onRename(id: string, name: string): Promise<void>;
	onDelete(id: string): Promise<void>;
}

export function WheelTabs({
	wheels,
	activeWheelID,
	onSwitch,
	onCreate,
	onRename,
	onDelete,
}: Props) {
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState('');
	const [copyFromID, setCopyFromID] = useState<string>('none');
	const [resetWeights, setResetWeights] = useState(false);
	const [creatingBusy, setCreatingBusy] = useState(false);

	const [renamingID, setRenamingID] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState('');

	const newNameInputRef = useRef<HTMLInputElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);

	// Focus creation input when form opens.
	useEffect(() => {
		if (creating) {
			setTimeout(() => newNameInputRef.current?.focus(), 0);
		}
	}, [creating]);

	// Focus rename input when rename starts.
	useEffect(() => {
		if (renamingID) {
			setTimeout(() => renameInputRef.current?.select(), 0);
		}
	}, [renamingID]);

	const openCreate = useCallback(() => {
		setNewName('');
		setCopyFromID('none');
		setResetWeights(false);
		setCreating(true);
	}, []);

	const cancelCreate = useCallback(() => {
		setCreating(false);
	}, []);

	const submitCreate = useCallback(async () => {
		const name = newName.trim();
		if (!name) return;
		setCreatingBusy(true);
		try {
			await onCreate(name, copyFromID === 'none' ? null : copyFromID, resetWeights);
			setCreating(false);
			setNewName('');
		}
		finally {
			setCreatingBusy(false);
		}
	}, [newName, copyFromID, resetWeights, onCreate]);

	const startRename = useCallback((wheel: Wheel) => {
		setRenamingID(wheel.id);
		setRenameValue(wheel.name);
	}, []);

	const submitRename = useCallback(async () => {
		if (!renamingID) return;
		const name = renameValue.trim();
		if (name) await onRename(renamingID, name);
		setRenamingID(null);
	}, [renamingID, renameValue, onRename]);

	const handleDelete = useCallback(
		async (event: React.MouseEvent, id: string) => {
			event.stopPropagation();
			const wheel = wheels.find((candidate) => candidate.id === id);
			if (!wheel) return;
			if (!window.confirm(`Delete "${wheel.name}" and all its activities? This cannot be undone.`))
				return;
			await onDelete(id);
		},
		[wheels, onDelete],
	);

	const sortedWheels = [...wheels].sort((wheel1, wheel2) => wheel1.createdAt - wheel2.createdAt);

	return (
		<div className="wheel-tabs-wrap">
			<div className="wheel-tabs" role="tablist" aria-label="Wheels">
				{sortedWheels.map((wheel) => {
					const isActive = wheel.id === activeWheelID;
					const isRenaming = renamingID === wheel.id;
					const isShared = wheel.kind === 'shared';
					const canDelete = !isShared && wheels.filter((candidate) => candidate.kind !== 'shared').length > 1;
					return (
						<div
							key={wheel.id}
							className={`wheel-tab${isActive ? ' wheel-tab-active' : ''}`}
							role="tab"
							aria-selected={isActive}
						>
							{isRenaming ? (
								<input
									ref={renameInputRef}
									className="wheel-tab-rename-input"
									value={renameValue}
									onChange={(event) => setRenameValue(event.target.value)}
									onBlur={() => void submitRename()}
									onKeyDown={(event) => {
										if (event.key === 'Enter') void submitRename();
										if (event.key === 'Escape') setRenamingID(null);
									}}
									aria-label="Rename wheel"
								/>
							) : (
								<button
									type="button"
									className="wheel-tab-btn"
									onClick={() => onSwitch(wheel.id)}
									onDoubleClick={() => {
										if (!isShared) startRename(wheel);
									}}
									title={isShared ? undefined : 'Double-click to rename'}
								>
									{isShared && <SharedWheelIcon />}
									{wheel.name}
									{/* {isActive && wheels.length > 1 && (
                    <span className="wheel-tab-hotkeys" aria-hidden="true">
                      <KeyboardHint label={HOTKEYS.PREV_WHEEL.label} />
                      <KeyboardHint label={HOTKEYS.NEXT_WHEEL.label} />
                    </span>
                  )} */}
								</button>
							)}
							{canDelete && !isRenaming && (
								<button
									type="button"
									className="wheel-tab-delete"
									onClick={(event) => void handleDelete(event, wheel.id)}
									aria-label={`Delete ${wheel.name}`}
									title={`Delete ${wheel.name}`}
								>
									×
								</button>
							)}
						</div>
					);
				})}

				{/* + button */}
				<button
					type="button"
					className="wheel-tab-add"
					onClick={openCreate}
					aria-label="Add a new wheel"
					title="Add a new wheel"
				>
					+
				</button>
			</div>

			{/* Inline create form */}
			{creating && (
				<div className="wheel-create-form">
					<input
						ref={newNameInputRef}
						className="wheel-create-name"
						type="text"
						placeholder="Wheel name…"
						value={newName}
						onChange={(event) => setNewName(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') void submitCreate();
							if (event.key === 'Escape') cancelCreate();
						}}
						maxLength={60}
					/>

					{wheels.length > 0 && (
						<label className="wheel-create-label">
							Copy from
							<select
								className="wheel-create-select"
								value={copyFromID}
								onChange={(event) => setCopyFromID(event.target.value)}
							>
								<option value="none">Blank wheel</option>
								{sortedWheels.map((wheel) => (
									<option key={wheel.id} value={wheel.id}>
										{wheel.name}
									</option>
								))}
							</select>
						</label>
					)}

					{copyFromID !== 'none' && (
						<label className="wheel-create-reset">
							<input
								type="checkbox"
								checked={resetWeights}
								onChange={(event) => setResetWeights(event.target.checked)}
							/>
							Reset activity weights to default
						</label>
					)}

					<div className="wheel-create-actions">
						<button
							type="button"
							className="btn btn-primary btn-small"
							onClick={() => void submitCreate()}
							disabled={creatingBusy || !newName.trim()}
						>
							{creatingBusy ? 'Creating…' : 'Create'}
						</button>
						<button type="button" className="btn btn-secondary btn-small" onClick={cancelCreate}>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
