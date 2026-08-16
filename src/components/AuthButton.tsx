import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DisplayNameEditor } from './reusable/DisplayNameEditor';
import { LoadingSpinner } from './reusable/LoadingSpinner';
import { hasSavedCloudWheels, migrateLocalDataToCloud } from '../services/cloud/migration-service';
import { toErrorMessage } from '../utils/error-message';
import { GoogleIcon } from './svg-icons/GoogleIcon';
import './AuthButton.css';

interface AuthButtonProps {
	/** Called after a successful local-to-cloud import so the caller can reload wheels. */
	onLocalDataImported(): void;
}

export function AuthButton({ onLocalDataImported }: AuthButtonProps) {
	const auth = useAuth();
	const [isEditingName, setIsEditingName] = useState(false);
	const [importStatus, setImportStatus] = useState<string | null>(null);
	const [canImportLocalWheels, setCanImportLocalWheels] = useState(false);

	const userID = auth.user?.id;
	useEffect(() => {
		if (!userID) return;
		hasSavedCloudWheels(userID).then((hasSavedWheels) => setCanImportLocalWheels(!hasSavedWheels));
	}, [userID]);

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
