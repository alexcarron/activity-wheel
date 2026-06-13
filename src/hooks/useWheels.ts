/**
 * `useWheels` — owns the list of wheels and the currently active wheel.
 *
 * The active wheel ID is persisted in localStorage so it survives page reloads.
 * When the active wheel changes, downstream hooks (useActivities, useTagFilter)
 * re-initialise automatically because they receive the new wheelId as a prop.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Wheel } from '../domain-logic/types';
import {
  listWheels,
  createWheel as svcCreate,
  renameWheel as svcRename,
  deleteWheel as svcDelete,
  copyWheel as svcCopy,
  touchWheel,
  getStoredActiveWheelId,
  persistActiveWheelId,
} from '../services/wheel-service';
import { useHotkey } from './useHotkey';
import { HOTKEYS } from '../hotkeys';

export interface UseWheelsApi {
  readonly wheels: readonly Wheel[];
  readonly activeWheelId: string;
  readonly loading: boolean;
  /** Switch the active wheel. Resets session + tag filter via downstream hooks. */
  switchWheel(id: string): void;
  /** Cycle to the wheel before the active one (wraps). */
  prevWheel(): void;
  /** Cycle to the wheel after the active one (wraps). */
  nextWheel(): void;
  /** Create a brand-new empty wheel. */
  createWheel(name: string): Promise<Wheel>;
  /**
   * Duplicate a wheel.
   * @param fromWheelId  Source wheel to copy from.
   * @param name         Name for the new wheel.
   * @param resetWeights If true, all copied activities start at default weight.
   */
  copyWheel(fromWheelId: string, name: string, resetWeights: boolean): Promise<Wheel>;
  /** Rename a wheel (inline). */
  renameWheel(id: string, name: string): Promise<void>;
  /** Delete a wheel and all its activities. Refuses if it's the only wheel. */
  deleteWheel(id: string): Promise<void>;
  /** Re-fetch the wheel list from IDB and sync React state. Use after bulk import/clear. */
  reloadWheels(): Promise<void>;
}

export function useWheels(): UseWheelsApi {
  const [wheels, setWheels] = useState<readonly Wheel[]>([]);
  const [activeWheelId, setActiveWheelId] = useState<string>(getStoredActiveWheelId);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      const list = await listWheels();
      if (!mounted.current) return;

      // Ensure the stored active wheel actually exists; fall back if not.
      const stored = getStoredActiveWheelId();
      const exists = list.some((w) => w.id === stored);
      let validId = stored;
      if (!exists && list.length > 0) {
        validId = list[0].id;
        persistActiveWheelId(validId);
        setActiveWheelId(validId);
      }

      // If there are no wheels at all (shouldn't happen after migration, but
      // handle defensively), create the default wheel.
      if (list.length === 0) {
        const defaultWheel = await svcCreate('My Wheel');
        validId = defaultWheel.id;
        persistActiveWheelId(validId);
        setActiveWheelId(validId);
        setWheels([defaultWheel]);
      } else {
        setWheels(list);
      }

      setLoading(false);
    })();
    return () => {
      mounted.current = false;
    };
  }, []);

  const switchWheel = useCallback((id: string): void => {
    persistActiveWheelId(id);
    setActiveWheelId(id);
    void touchWheel(id);
    setWheels((prev) =>
      prev.map((w) => (w.id === id ? { ...w, lastUsedAt: Date.now() } : w)),
    );
  }, []);

  const prevWheel = useCallback((): void => {
    setWheels((current) => {
      const idx = current.findIndex((w) => w.id === activeWheelId);
      if (current.length < 2 || idx === -1) return current;
      const prev = current[(idx - 1 + current.length) % current.length];
      persistActiveWheelId(prev.id);
      setActiveWheelId(prev.id);
      void touchWheel(prev.id);
      return current.map((w) => (w.id === prev.id ? { ...w, lastUsedAt: Date.now() } : w));
    });
  }, [activeWheelId]);

  const nextWheel = useCallback((): void => {
    setWheels((current) => {
      const idx = current.findIndex((w) => w.id === activeWheelId);
      if (current.length < 2 || idx === -1) return current;
      const next = current[(idx + 1) % current.length];
      persistActiveWheelId(next.id);
      setActiveWheelId(next.id);
      void touchWheel(next.id);
      return current.map((w) => (w.id === next.id ? { ...w, lastUsedAt: Date.now() } : w));
    });
  }, [activeWheelId]);

  useHotkey(HOTKEYS.PREV_WHEEL.code, prevWheel, wheels.length > 1);
  useHotkey(HOTKEYS.NEXT_WHEEL.code, nextWheel, wheels.length > 1);

  const createWheel = useCallback(async (name: string): Promise<Wheel> => {
    const w = await svcCreate(name);
    if (mounted.current) setWheels((prev) => [...prev, w]);
    return w;
  }, []);

  const copyWheel = useCallback(
    async (fromWheelId: string, name: string, resetWeights: boolean): Promise<Wheel> => {
      const w = await svcCopy(fromWheelId, name, resetWeights);
      if (mounted.current) setWheels((prev) => [...prev, w]);
      return w;
    },
    [],
  );

  const renameWheel = useCallback(async (id: string, name: string): Promise<void> => {
    const updated = await svcRename(id, name);
    if (mounted.current) {
      setWheels((prev) => prev.map((w) => (w.id === id ? updated : w)));
    }
  }, []);

  const deleteWheel = useCallback(
    async (id: string): Promise<void> => {
      if (wheels.length <= 1) throw new Error('Cannot delete the only wheel');
      await svcDelete(id);
      setWheels((prev) => {
        const next = prev.filter((w) => w.id !== id);
        // If we deleted the active wheel, switch to the first remaining one.
        if (activeWheelId === id && next.length > 0) {
          persistActiveWheelId(next[0].id);
          setActiveWheelId(next[0].id);
        }
        return next;
      });
    },
    [wheels.length, activeWheelId],
  );

  const reloadWheels = useCallback(async (): Promise<void> => {
    const list = await listWheels();
    if (!mounted.current) return;
    setWheels(list);
    // If the stored active wheel no longer exists, fall back to first.
    const stored = getStoredActiveWheelId();
    if (!list.some((w) => w.id === stored) && list.length > 0) {
      persistActiveWheelId(list[0].id);
      setActiveWheelId(list[0].id);
    }
  }, []);

  return useMemo<UseWheelsApi>(
    () => ({
      wheels,
      activeWheelId,
      loading,
      switchWheel,
      prevWheel,
      nextWheel,
      createWheel,
      copyWheel,
      renameWheel,
      deleteWheel,
      reloadWheels,
    }),
    [
      wheels, activeWheelId, loading,
      switchWheel, prevWheel, nextWheel,
      createWheel, copyWheel, renameWheel, deleteWheel, reloadWheels,
    ],
  );
}
