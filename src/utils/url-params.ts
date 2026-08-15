/** Reads the ?sharedWheelID=... query param used to link into a shared wheel. */
export function getSharedWheelIDFromUrl(): string | null {
	return new URLSearchParams(window.location.search).get('sharedWheelId');
}

/** Strips ?sharedWheelID=... from the URL without a page reload, e.g. once it's known to be invalid. */
export function removeSharedWheelIDFromUrl(): void {
	const url = new URL(window.location.href);
	url.searchParams.delete('sharedWheelId');
	window.history.replaceState({}, '', url);
}
