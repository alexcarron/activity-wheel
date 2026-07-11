/**
 * Small inline spinner for brief (sub-second) loading states, such as auth
 * resolving or wheel/activity data syncing after sign-in/out. Uses currentColor
 * so it adapts to light/dark mode automatically.
 */

interface LoadingSpinnerProps {
	readonly size?: number;
}

export function LoadingSpinner({ size = 14 }: LoadingSpinnerProps) {
	return (
		<svg
			className="loading-spinner"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			role="status"
			aria-label="Loading"
		>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
			<path
				d="M21 12a9 9 0 0 0-9-9"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
			/>
		</svg>
	);
}
