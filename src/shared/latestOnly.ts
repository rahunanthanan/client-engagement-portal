/**
 * Stale-response guard for code that is not managed by TanStack Query.
 * Each call aborts the previous one and only the latest call's result is delivered.
 *
 *   const search = latestOnly((q, signal) => api.searchClients(q, 1, 10, signal));
 *   const result = await search('acme'); // resolves `{ stale: true }` if a newer call started
 */
export function latestOnly<Args extends unknown[], R>(fn: (...args: [...Args, AbortSignal]) => Promise<R>) {
  let current: AbortController | null = null;
  let callId = 0;
  return async (...args: Args): Promise<{ stale: false; value: R } | { stale: true }> => {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    callId += 1;
    const id = callId;
    try {
      const value = await fn(...args, controller.signal);
      return id === callId ? { stale: false, value } : { stale: true };
    } catch (error) {
      if (id !== callId || controller.signal.aborted) return { stale: true };
      throw error;
    }
  };
}
