/**
 * Switches for SIMULATED failure scenarios. Toggled from the in-app "Simulation" panel, from tests,
 * or from Playwright via `window.__cep.scenarios`.
 */
export interface Scenarios {
  /** Base latency added to every simulated API response (ms). */
  latencyMs: number;
  /** none | transient: one 503 that the client retries automatically | persistent: every save fails. */
  saveFailure: 'none' | 'transient' | 'persistent';
  /** The next draft save's response is delayed so a later save's response arrives first. */
  delayNextSaveResponseMs: number;
  /** A fictional colleague edits the draft just before the next save arrives (causes 409). */
  conflictOnNextSave: boolean;
  /** The next API call returns 401 (session expired at the server). */
  expireSessionOnNextCall: boolean;
  /** The next task action returns 403 (task reassigned). */
  denyNextTaskAction: boolean;
  /** The next submission fails server-side validation (422). */
  rejectNextSubmission: boolean;
  /** Random 0–900 ms latency on client search to demonstrate stale-response protection. */
  searchJitter: boolean;
}

export const defaultScenarios: Scenarios = {
  latencyMs: 0,
  saveFailure: 'none',
  delayNextSaveResponseMs: 0,
  conflictOnNextSave: false,
  expireSessionOnNextCall: false,
  denyNextTaskAction: false,
  rejectNextSubmission: false,
  searchJitter: false,
};

let current: Scenarios = { ...defaultScenarios };

/** Immutable snapshot (safe for useSyncExternalStore). */
export function getScenarios(): Scenarios {
  return current;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function setScenarios(patch: Partial<Scenarios>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

export function resetScenarios(): void {
  setScenarios(defaultScenarios);
}

export function subscribeScenarios(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
