/**
 * Inline editor for the signed-in user's display name, opened from AuthButton.
 * Autosaves on blur/Enter (no explicit Save/Cancel buttons); Escape reverts.
 */

import { useRef, useState } from 'react';
import './DisplayNameEditor.css';

interface DisplayNameEditorProps {
	currentName: string;
	onSave(name: string): Promise<void>;
	onCancel(): void;
}

export function DisplayNameEditor({ currentName, onSave, onCancel }: DisplayNameEditorProps) {
	const [name, setName] = useState(currentName);
	const hasSettledRef = useRef(false);

	const commit = async (): Promise<void> => {
		if (hasSettledRef.current) return;
		hasSettledRef.current = true;
		const trimmed = name.trim();
		if (trimmed && trimmed !== currentName) {
			await onSave(trimmed);
		}
		else {
			onCancel();
		}
	};

	const revert = (): void => {
		if (hasSettledRef.current) return;
		hasSettledRef.current = true;
		onCancel();
	};

	return (
		<input
			type="text"
			className="display-name-editor-input"
			value={name}
			onChange={(event) => setName(event.target.value)}
			onBlur={() => void commit()}
			onKeyDown={(event) => {
				if (event.key === 'Enter') event.currentTarget.blur();
				if (event.key === 'Escape') revert();
			}}
			autoFocus
			maxLength={80}
		/>
	);
}
