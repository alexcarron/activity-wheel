/**
 * `useTagFilter` — owns the tag filter UI state (session-only) and the
 * per-wheel tag metadata (IDB-persisted).
 *
 * Filter state is intentionally NOT persisted — it resets on every page
 * reload AND whenever the active wheel changes, by design.
 *
 * Tag metadata IS persisted via tag-service and is loaded on mount and
 * whenever the wheelId changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TagMetadata } from '../domain-logic/types';
import type { FilterMode } from '../domain-logic/tag-filter-logic';
import {
  listTagMetadata,
  setTagColor as persistTagColor,
  ensureTagsExist,
} from '../services/tag-service';

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

export function useTagFilter(wheelId: string): TagFilterApi {
  const [activeTags, setActiveTags] = useState<readonly string[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('OR');
  const [tagMetadata, setTagMetadata] = useState<readonly TagMetadata[]>([]);
  const mounted = useRef(true);
  const wheelRef = useRef(wheelId);
  wheelRef.current = wheelId;

  // Reload tag metadata whenever the active wheel changes.
  // Also reset all filter state so the new wheel starts clean.
  useEffect(() => {
    mounted.current = true;
    setActiveTags([]);
    setUntaggedOnly(false);
    setFilterMode('OR');
    void listTagMetadata(wheelId).then((meta) => {
      if (mounted.current) setTagMetadata(meta);
    });
    return () => {
      mounted.current = false;
    };
  }, [wheelId]);

  const toggleTag = useCallback((name: string): void => {
    setUntaggedOnly(false);
    setActiveTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
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
    setFilterMode((m) => (m === 'OR' ? 'AND' : 'OR'));
  }, []);

  const setTagColor = useCallback(
    async (name: string, color: string | null): Promise<void> => {
      await persistTagColor(wheelRef.current, name, color);
      setTagMetadata((prev) => {
        const exists = prev.some((t) => t.name === name);
        const key = `${wheelRef.current}:${name}`;
        if (exists) {
          return prev.map((t) =>
            t.name === name
              ? color
                ? { key, wheelId: wheelRef.current, name, color }
                : { key, wheelId: wheelRef.current, name }
              : t,
          );
        }
        return color
          ? [...prev, { key, wheelId: wheelRef.current, name, color }]
          : [...prev, { key, wheelId: wheelRef.current, name }];
      });
    },
    [],
  );

  const registerTags = useCallback(async (names: string[]): Promise<void> => {
    if (names.length === 0) return;
    await ensureTagsExist(wheelRef.current, names);
    setTagMetadata((prev) => {
      const existing = new Set(prev.map((t) => t.name));
      const fresh = names
        .map((n) => n.trim())
        .filter((n) => n && !existing.has(n))
        .map((name): TagMetadata => ({
          key: `${wheelRef.current}:${name}`,
          wheelId: wheelRef.current,
          name,
        }));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
  }, []);

  const reloadMetadata = useCallback(async (): Promise<void> => {
    const meta = await listTagMetadata(wheelRef.current);
    if (mounted.current) setTagMetadata(meta);
  }, []);

  const pruneTags = useCallback((names: string[]): void => {
    const pruned = new Set(names);
    setTagMetadata((prev) => prev.filter((t) => !pruned.has(t.name)));
    setActiveTags((prev) => prev.filter((t) => !pruned.has(t)));
  }, []);

  return useMemo<TagFilterApi>(
    () => ({
      activeTags, untaggedOnly, filterMode,
      toggleTag, toggleUntagged, clearFilter, toggleMode,
      tagMetadata, setTagColor, registerTags, reloadMetadata, pruneTags,
    }),
    [
      activeTags, untaggedOnly, filterMode,
      toggleTag, toggleUntagged, clearFilter, toggleMode,
      tagMetadata, setTagColor, registerTags, reloadMetadata, pruneTags,
    ],
  );
}
