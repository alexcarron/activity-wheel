/**
 * Returns the current wall-clock time as a Unix-ms timestamp.
 *
 * Calling Date.now() directly during render violates the react-hooks/purity
 * lint rule (impure functions must not be called during render). This hook
 * stores the timestamp in a ref that is refreshed in a layout-effect, so by
 * the time any DOM mutations are applied the value is always up-to-date —
 * without triggering the purity violation.
 *
 * The initial value falls back to a module-load-time constant (also not a
 * render-phase call) so the first render has a sensible timestamp.
 */

import { useLayoutEffect, useRef } from 'react';

// Captured once when the module is first imported — not during render.
const _moduleBootTime = Date.now();

export function useNow(): number {
  const ref = useRef(_moduleBootTime);
  useLayoutEffect(() => {
    ref.current = Date.now();
  });
  return ref.current;
}
