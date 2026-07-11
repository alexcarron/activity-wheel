/**
 * Tiny form to append a new activity. Trims input, ignores empty submissions, and clears itself on success. The owning hook handles persistence. 
 */

import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import './AddActivity.css';
import { useViewportBreakpoint } from '../hooks/useViewportBreakpoint';
import { AddActivityButton } from './AddActivityButton';

const ADD_ACTIVITY_FORM_ID = 'add-activity-form';

interface Props {
	onAdd(name: string): Promise<void>;
	mobileButtonContainer: HTMLElement | null;
}

export function AddActivity({ onAdd, mobileButtonContainer }: Props) {
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const { isPhone } = useViewportBreakpoint();

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

	const addActivityButton = (
		<AddActivityButton formId={ADD_ACTIVITY_FORM_ID} disabled={busy || name.trim().length === 0} />
	);

	return (
		<form id={ADD_ACTIVITY_FORM_ID} className="add-activity" onSubmit={submit}>
			<input
				type="text"
				className="add-activity-input"
				placeholder="Add an activity (e.g. Play Celeste)"
				value={name}
				onChange={(event) => setName(event.target.value)}
				maxLength={120}
				disabled={busy}
			/>
			{!isPhone && addActivityButton}
			{isPhone && mobileButtonContainer && createPortal(addActivityButton, mobileButtonContainer)}
		</form>
	);
}
