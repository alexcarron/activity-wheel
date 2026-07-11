/**
 * Top-right auth control, anchored in the wheel header (where the pin button
 * used to sit). Shows a minimal "Sign in with Google" button when signed out,
 * or the resolved display name (click to edit) when signed in.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DisplayNameEditor } from './DisplayNameEditor';
import { LoadingSpinner } from './LoadingSpinner';
import { hasSavedCloudWheels, migrateLocalDataToCloud } from '../services/cloud/migration-service';
import { toErrorMessage } from '../utils/error-message';

interface AuthButtonProps {
	/** Called after a successful local-to-cloud import so the caller can reload wheels. */
	onLocalDataImported(): void;
}

function GoogleIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.33A9 9 0 0 0 9 18Z"
			/>
			<path
				fill="#FBBC05"
				d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.94A9 9 0 0 0 0 9c0 1.45.35 2.83.94 4.05l3.03-2.33Z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .94 4.95l3.03 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
			/>
		</svg>
	);
}

export function AuthButton({ onLocalDataImported }: AuthButtonProps) {
	const auth = useAuth();
	const [isEditingName, setIsEditingName] = useState(false);
	const [importStatus, setImportStatus] = useState<string | null>(null);
	const [canImportLocalWheels, setCanImportLocalWheels] = useState(false);

	const userId = auth.user?.id;
	useEffect(() => {
		if (!userId) return;
		hasSavedCloudWheels(userId).then((hasSavedWheels) => setCanImportLocalWheels(!hasSavedWheels));
	}, [userId]);

	if (auth.loading) {
		return (
			<div className="auth-button auth-button-loading">
				<LoadingSpinner />
			</div>
		);
	}

	if (!auth.user) {
		return (
			<button
				type="button"
				className="google-signin-btn"
				onClick={() => void auth.signInWithGoogle()}
			>
				<GoogleIcon />
				Sign in with Google
			</button>
		);
	}

	if (isEditingName) {
		return (
			<DisplayNameEditor
				currentName={auth.displayName ?? ''}
				onSave={async (name) => {
					await auth.updateDisplayName(name);
					setIsEditingName(false);
				}}
				onCancel={() => setIsEditingName(false)}
			/>
		);
	}

	const handleImportLocalData = async (): Promise<void> => {
		if (!auth.user) return;
		if (
			!window.confirm(
				"Import this browser's local wheels into your account? This only works once, before your account has any saved wheels.",
			)
		)
			return;
		setImportStatus('Importing…');
		try {
			const count = await migrateLocalDataToCloud(auth.user.id);
			setImportStatus(count > 0 ? `Imported ${count} wheel(s).` : 'No local wheels to import.');
			setCanImportLocalWheels(false);
			onLocalDataImported();
		}
		catch (error) {
			setImportStatus(toErrorMessage(error));
		}
	};

	return (
		<div className="auth-button auth-button-signed-in">
			<button type="button" className="auth-button-name" onClick={() => setIsEditingName(true)}>
				{auth.displayName}
			</button>
			{canImportLocalWheels && (
				<button type="button" className="auth-button-import" onClick={() => void handleImportLocalData()}>
					Import local wheels
				</button>
			)}
			<button type="button" className="auth-button-signout" onClick={() => void auth.signOut()}>
				Sign out
			</button>
			{importStatus && <span className="auth-button-import-status">{importStatus}</span>}
		</div>
	);
}
