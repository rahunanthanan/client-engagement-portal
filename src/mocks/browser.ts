import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** SIMULATED BACKEND for the browser (dev server, preview build and container demo). */
export const worker = setupWorker(...handlers);
