import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { resetDb } from '@/mocks/db';
import { resetScenarios } from '@/mocks/scenarios';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  // Unmount first, so resetting the simulated backend never updates a still-mounted tree outside act().
  cleanup();
  server.resetHandlers();
  resetScenarios();
  resetDb();
  sessionStorage.clear();
  localStorage.clear();
});
afterAll(() => server.close());

// MUI/Autocomplete and some components use these browser APIs that jsdom lacks.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? function scrollIntoView() {};
