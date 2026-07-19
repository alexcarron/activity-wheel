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
	readonly activeTagIds: readonly string[];
	readonly untaggedOnly: boolean;
	readonly filterMode: FilterMode;

	toggleTag(id: string): void;
	toggleUntagged(): void;
	clearFilter(): void;
	toggleMode(): void;

	readonly tagMetadata: readonly TagMetadata[];

	setTagColor(id: string, color: string | null): Promise<void>;
	renameTag(id: string, newName: string): Promise<TagMetadata>;
	registerTags(names: string[]): Promise<TagMetadata[]>;
	reloadMetadata(): Promise<void>;
	pruneTags(ids: string[]): void;
}

export function useTagFilter(
	wheelId: string,
	userId: string | null,
	sharedWheelId: string | null,
): TagFilterApi {
	// Memoized separately from the owned-wheel backend so that userId changing (e.g. sign-out) while a shared wheel is active can't produce a new tagService reference and retrigger the fetch effect below under a session that no longer has access.
	const sharedTagService = useMemo(() => createSharedTagService(), []);
	const ownedTagService = useMemo(
		() => (userId ? createCloudTagService(userId) : localTagService),
		[userId],
	);
	const tagService: CloudTagService = sharedWheelId ? sharedTagService : ownedTagService;

	const [activeTagIds, setActiveTagIds] = useState<readonly string[]>([]);
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
		setActiveTagIds([]);
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

	const toggleTag = useCallback((id: string): void => {
		setUntaggedOnly(false);
		setActiveTagIds((prev) =>
			prev.includes(id) ? prev.filter((tagId) => tagId !== id) : [...prev, id],
		);
	}, []);

	const toggleUntagged = useCallback((): void => {
		setActiveTagIds([]);
		setUntaggedOnly((prev) => !prev);
	}, []);

	const clearFilter = useCallback((): void => {
		setActiveTagIds([]);
		setUntaggedOnly(false);
		setFilterMode('OR');
	}, []);

	const toggleMode = useCallback((): void => {
		setFilterMode((mode) => (mode === 'OR' ? 'AND' : 'OR'));
	}, []);

	const setTagColor = useCallback(
		async (id: string, color: string | null): Promise<void> => {
			const saved = await tagService.setTagColor(wheelRef.current, id, color);
			setTagMetadata((prev) => {
				const exists = prev.some((tag) => tag.id === id);
				return exists
					? prev.map((tag) => (tag.id === id ? saved : tag))
					: [...prev, saved];
			});
		},
		[tagService],
	);

	const renameTag = useCallback(
		async (id: string, newName: string): Promise<TagMetadata> => {
			const saved = await tagService.renameTag(wheelRef.current, id, newName);
			setTagMetadata((prev) => prev.map((tag) => (tag.id === id ? saved : tag)));
			return saved;
		},
		[tagService],
	);

	const registerTags = useCallback(
		async (names: string[]): Promise<TagMetadata[]> => {
			if (names.length === 0) return [];
			const resolved = await tagService.ensureTagsExist(wheelRef.current, names);
			setTagMetadata((prev) => {
				const existingIds = new Set(prev.map((tag) => tag.id));
				const fresh = resolved.filter((tag) => !existingIds.has(tag.id));
				return fresh.length === 0 ? prev : [...prev, ...fresh];
			});
			return resolved;
		},
		[tagService],
	);

	const reloadMetadata = useCallback(async (): Promise<void> => {
		const metadata = await tagService.listTagMetadata(wheelRef.current);
		if (mounted.current) setTagMetadata(metadata);
	}, [tagService]);

	const pruneTags = useCallback((ids: string[]): void => {
		const pruned = new Set(ids);
		setTagMetadata((prev) => prev.filter((tag) => !pruned.has(tag.id)));
		setActiveTagIds((prev) => prev.filter((id) => !pruned.has(id)));
	}, []);

	return useMemo<TagFilterApi>(
		() => ({
			activeTagIds,
			untaggedOnly,
			filterMode,
			toggleTag,
			toggleUntagged,
			clearFilter,
			toggleMode,
			tagMetadata,
			setTagColor,
			renameTag,
			registerTags,
			reloadMetadata,
			pruneTags,
		}),
		[
			activeTagIds,
			untaggedOnly,
			filterMode,
			toggleTag,
			toggleUntagged,
			clearFilter,
			toggleMode,
			tagMetadata,
			setTagColor,
			renameTag,
			registerTags,
			reloadMetadata,
			pruneTags,
		],
	);
}
