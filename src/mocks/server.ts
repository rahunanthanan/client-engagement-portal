import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** SIMULATED BACKEND for Jest (Node request interception). */
export const server = setupServer(...handlers);
