/** Reads the ?sharedWheelId=... query param used to link into a shared wheel. */
export function getSharedWheelIdFromUrl(): string | null {
	return new URLSearchParams(window.location.search).get('sharedWheelId');
}

/** Strips ?sharedWheelId=... from the URL without a page reload, e.g. once it's known to be invalid. */
export function removeSharedWheelIdFromUrl(): void {
	const url = new URL(window.location.href);
	url.searchParams.delete('sharedWheelId');
	window.history.replaceState({}, '', url);
}
