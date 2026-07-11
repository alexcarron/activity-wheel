/**
 * Tiny form to append a new activity. Trims input, ignores empty submissions, and clears itself on success. The owning hook handles persistence. 
 */

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
	onAdd(name: string): Promise<void>;
}

export function AddActivity({ onAdd }: Props) {
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);

	const submit = useCallback(
		async (event: FormEvent): Promise<void> => {
			event.preventDefault();
			const trimmed = name.trim();
			if (!trimmed) return;
			setBusy(true);
			try {
				await onAdd(trimmed);
				setName('');
			}
			finally {
				setBusy(false);
			}
		},
		[name, onAdd],
	);

	return (
		<form className="add-activity" onSubmit={submit}>
			<input
				type="text"
				className="add-activity-input"
				placeholder="Add an activity (e.g. Play Celeste)"
				value={name}
				onChange={(event) => setName(event.target.value)}
				maxLength={120}
				disabled={busy}
			/>
			<button type="submit" className="btn btn-primary" disabled={busy || name.trim().length === 0}>
				Add
			</button>
		</form>
	);
}
