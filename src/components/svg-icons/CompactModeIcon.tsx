export function CompactModeIcon({ isCompact }: { isCompact: boolean }) {
	if (isCompact) {
		return (
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
				<line x1="1" y1="2.5" x2="13" y2="2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				<line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				<line x1="1" y1="11.5" x2="13" y2="11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
			</svg>
		);
	}

	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
			<line x1="1" y1="1.5" x2="13" y2="1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="1" y1="6.5" x2="13" y2="6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="1" y1="9" x2="13" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
			<line x1="1" y1="11.5" x2="13" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
		</svg>
	);
}
