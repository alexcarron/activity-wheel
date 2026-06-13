import { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';

interface SpinCountContextType {
  spinCount: number;
  incrementSpinCount(): void;
  resetSpinCount(): void;
}

const SpinCountContext = createContext<SpinCountContextType | undefined>(undefined);

export function SpinCountProvider({ children }: { children: ReactNode }) {
  const [spinCount, setSpinCount] = useState(0);

  const value = useMemo<SpinCountContextType>(
    () => ({
      spinCount,
      incrementSpinCount: () => {
        setSpinCount((prev) => {
          const next = prev + 1;
          return next;
        });
      },
      resetSpinCount: () => {
        setSpinCount(0);
      },
    }),
    [spinCount],
  );

  return (
    <SpinCountContext.Provider value={value}>
      {children}
    </SpinCountContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSpinCount(): SpinCountContextType {
  const context = useContext(SpinCountContext);
  if (!context) {
    throw new Error('useSpinCount must be used within a SpinCountProvider');
  }
  return context;
}
