/**
 * JSON backup / restore for all wheels.
 *
 *  - Export downloads a `.json` file with every wheel, activity, and tag.
 *  - Import accepts a file and replaces ALL wheels (with a warning).
 *  - Clear wheel removes all activities + tags from the active wheel only.
 *  - Clear all wheels wipes everything and starts fresh with one blank wheel.
 */

import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

interface Props {
	exportJson(): Promise<string>;
	importJson(json: string): Promise<void>;
	clearWheel(): Promise<void>;
	clearAllWheels(): Promise<void>;
}

export function BackupControls({ exportJson, importJson, clearWheel, clearAllWheels }: Props) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [status, setStatus] = useState<string | null>(null);

	const onExport = useCallback(async (): Promise<void> => {
		setStatus(null);
		try {
			const json = await exportJson();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `activity-wheel-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			setStatus('Backup downloaded.');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err));
		}
	}, [exportJson]);

	const onImport = useCallback(
		async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
			const file = e.target.files?.[0];
			e.target.value = '';
			if (!file) return;
			if (!window.confirm(
				'Importing will DELETE ALL existing wheels and replace them with the wheels in this file. This cannot be undone. Continue?',
			)) return;
			try {
				const text = await file.text();
				await importJson(text);
				setStatus(`Imported "${file.name}".`);
			} catch (err) {
				setStatus(err instanceof Error ? err.message : String(err));
			}
		},
		[importJson],
	);

	const onClearWheel = useCallback(async (): Promise<void> => {
		if (!window.confirm('Delete all activities and tags in this wheel? This cannot be undone.')) return;
		try {
			await clearWheel();
			setStatus('Wheel cleared.');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err));
		}
	}, [clearWheel]);

	const onClearAllWheels = useCallback(async (): Promise<void> => {
		if (!window.confirm(
			'Delete ALL wheels and all their activities? This cannot be undone. You will be left with one blank wheel.',
		)) return;
		try {
			await clearAllWheels();
			setStatus('All wheels deleted. Starting fresh.');
		} catch (err) {
			setStatus(err instanceof Error ? err.message : String(err));
		}
	}, [clearAllWheels]);

	return (
		<details className="backup">
			<summary className="backup-summary">Backup &amp; restore</summary>
			<div className="backup-body">
				<p className="backup-help">
					Your data lives in this browser's IndexedDB. Export exports <strong>all wheels</strong> to
					JSON; import replaces all wheels with the file contents.
				</p>
				<div className="backup-actions">
					<button type="button" className="btn btn-secondary" onClick={() => void onExport()}>
						Export JSON
					</button>
					<button
						type="button"
						className="btn btn-secondary"
						onClick={() => fileRef.current?.click()}
					>
						Import JSON
					</button>
					<input
						ref={fileRef}
						type="file"
						accept="application/json"
						className="visually-hidden"
						onChange={(e) => void onImport(e)}
					/>
					<button type="button" className="btn btn-danger" onClick={() => void onClearWheel()}>
						Clear wheel
					</button>
					<button type="button" className="btn btn-danger" onClick={() => void onClearAllWheels()}>
						Clear all wheels
					</button>
				</div>
				{status && <p className="backup-status">{status}</p>}
			</div>
		</details>
	);
}
