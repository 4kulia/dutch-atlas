import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

// One leg = the trip between two consecutive stops in a route. Day index +
// stop index uniquely identify it. Minutes/meters come from Google Directions.

export interface RouteLeg {
  dayIdx: number;
  stopIdx: number;     // index of the destination stop within its day (1-based for stops after the first)
  minutes: number;
  meters: number;
}

interface Value {
  legs: RouteLeg[];
  isLoading: boolean;
  error: string | null;
  setLegs: (legs: RouteLeg[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}

const RouteDirectionsContext = createContext<Value | null>(null);

export function RouteDirectionsProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = useMemo<Value>(
    () => ({ legs, isLoading, error, setLegs, setLoading, setError }),
    [legs, isLoading, error],
  );
  return <RouteDirectionsContext.Provider value={value}>{children}</RouteDirectionsContext.Provider>;
}

export function useRouteDirections(): Value {
  const ctx = useContext(RouteDirectionsContext);
  if (!ctx) throw new Error('useRouteDirections must be used inside <RouteDirectionsProvider>');
  return ctx;
}

export function findLeg(legs: RouteLeg[], dayIdx: number, stopIdx: number): RouteLeg | undefined {
  return legs.find((l) => l.dayIdx === dayIdx && l.stopIdx === stopIdx);
}
