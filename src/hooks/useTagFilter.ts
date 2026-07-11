/**
 * `useTagFilter`. Owns the tag filter UI state (session-only) and the per-wheel tag metadata (persisted).
 * Filter state is intentionally NOT persisted. It resets on every page reload AND whenever the active wheel changes, by design.
 * Tag metadata IS persisted via tag-service (IndexedDB when signed out, Supabase when signed in) and is loaded on mount and whenever the wheelId or auth state changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TagMetadata } from '../domain-logic/types';
import type { FilterMode } from '../domain-logic/tag-filter-logic';
import * as localTagService from '../services/tag-service';
import { createCloudTagService, type CloudTagService } from '../services/cloud/tag-service';
import { createSharedTagService } from '../services/cloud/shared-tag-service';

export type { FilterMode };

export interface TagFilterApi {
	readonly activeTags: readonly string[];
	readonly untaggedOnly: boolean;
	readonly filterMode: FilterMode;

	toggleTag(name: string): void;
	toggleUntagged(): void;
	clearFilter(): void;
	toggleMode(): void;

	readonly tagMetadata: readonly TagMetadata[];

	setTagColor(name: string, color: string | null): Promise<void>;
	registerTags(names: string[]): Promise<void>;
	reloadMetadata(): Promise<void>;
	pruneTags(names: string[]): void;
}

export function useTagFilter(
	wheelId: string,
	userId: string | null,
	sharedWheelId: string | null,
): TagFilterApi {
	const tagService: CloudTagService = useMemo(
		() =>
			sharedWheelId
				? createSharedTagService()
				: userId
					? createCloudTagService(userId)
					: localTagService,
		[userId, sharedWheelId],
	);

	const [activeTags, setActiveTags] = useState<readonly string[]>([]);
	const [untaggedOnly, setUntaggedOnly] = useState(false);
	const [filterMode, setFilterMode] = useState<FilterMode>('OR');
	const [tagMetadata, setTagMetadata] = useState<readonly TagMetadata[]>([]);
	const mounted = useRef(true);
	const wheelRef = useRef(wheelId);
	useEffect(() => {
		wheelRef.current = wheelId;
	}, [wheelId]);

	// Reload tag metadata whenever the active wheel or backend changes.
	// Also reset all filter state so the new wheel starts clean.
	// An empty wheelId means useWheels hasn't resolved an active wheel yet.
	useEffect(() => {
		mounted.current = true;
		// Intentional: this effect's job is to reset filter state for the newly
		// active wheel before fetching its tag metadata.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setActiveTags([]);
		setUntaggedOnly(false);
		setFilterMode('OR');
		if (!wheelId) {
			setTagMetadata([]);
			return;
		}
		void tagService.listTagMetadata(wheelId).then((metadata) => {
			if (mounted.current) setTagMetadata(metadata);
		});
		return () => {
			mounted.current = false;
		};
	}, [wheelId, tagService]);

	const toggleTag = useCallback((name: string): void => {
		setUntaggedOnly(false);
		setActiveTags((prev) =>
			prev.includes(name) ? prev.filter((tag) => tag !== name) : [...prev, name],
		);
	}, []);

	const toggleUntagged = useCallback((): void => {
		setActiveTags([]);
		setUntaggedOnly((prev) => !prev);
	}, []);

	const clearFilter = useCallback((): void => {
		setActiveTags([]);
		setUntaggedOnly(false);
		setFilterMode('OR');
	}, []);

	const toggleMode = useCallback((): void => {
		setFilterMode((mode) => (mode === 'OR' ? 'AND' : 'OR'));
	}, []);

	const setTagColor = useCallback(
		async (name: string, color: string | null): Promise<void> => {
			const saved = await tagService.setTagColor(wheelRef.current, name, color);
			setTagMetadata((prev) => {
				const exists = prev.some((tag) => tag.name === name);
				return exists
					? prev.map((tag) => (tag.name === name ? saved : tag))
					: [...prev, saved];
			});
		},
		[tagService],
	);

	const registerTags = useCallback(
		async (names: string[]): Promise<void> => {
			if (names.length === 0) return;
			await tagService.ensureTagsExist(wheelRef.current, names);
			setTagMetadata((prev) => {
				const existing = new Set(prev.map((tag) => tag.name));
				const fresh = names
					.map((tagName) => tagName.trim())
					.filter((tagName) => tagName && !existing.has(tagName))
					.map((name): TagMetadata => ({
						key: `${wheelRef.current}:${name}`,
						wheelId: wheelRef.current,
						name,
					}));
				return fresh.length === 0 ? prev : [...prev, ...fresh];
			});
		},
		[tagService],
	);

	const reloadMetadata = useCallback(async (): Promise<void> => {
		const metadata = await tagService.listTagMetadata(wheelRef.current);
		if (mounted.current) setTagMetadata(metadata);
	}, [tagService]);

	const pruneTags = useCallback((names: string[]): void => {
		const pruned = new Set(names);
		setTagMetadata((prev) => prev.filter((tag) => !pruned.has(tag.name)));
		setActiveTags((prev) => prev.filter((tag) => !pruned.has(tag)));
	}, []);

	return useMemo<TagFilterApi>(
		() => ({
			activeTags,
			untaggedOnly,
			filterMode,
			toggleTag,
			toggleUntagged,
			clearFilter,
			toggleMode,
			tagMetadata,
			setTagColor,
			registerTags,
			reloadMetadata,
			pruneTags,
		}),
		[
			activeTags,
			untaggedOnly,
			filterMode,
			toggleTag,
			toggleUntagged,
			clearFilter,
			toggleMode,
			tagMetadata,
			setTagColor,
			registerTags,
			reloadMetadata,
			pruneTags,
		],
	);
}
