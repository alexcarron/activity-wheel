/**
 * Global React context for the weight pool info.
 *
 * Every component that calls a weight function must be inside a
 * <WeightProvider>. The context is NEVER undefined — consuming it outside a
 * provider throws immediately so bugs surface early.
 *
 * Usage:
 *   const ctx = useWeightContext();
 *   const eff = effectiveWeight(activity, now, ctx);
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { GlobalWeightContext } from '../domain-logic/weight-logic';

const WeightContext = createContext<GlobalWeightContext | null>(null);

interface WeightProviderProps {
  readonly children: ReactNode;
  readonly value: GlobalWeightContext;
}

export function WeightProvider({ children, value }: WeightProviderProps) {
  return <WeightContext.Provider value={value}>{children}</WeightContext.Provider>;
}

/**
 * Returns the current GlobalWeightContext. Throws if called outside a
 * <WeightProvider> — the context is never allowed to be undefined.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useWeightContext(): GlobalWeightContext {
  const ctx = useContext(WeightContext);
  if (ctx === null) {
    throw new Error('useWeightContext must be called inside a <WeightProvider>');
  }
  return ctx;
}
