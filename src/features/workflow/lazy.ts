import { lazy } from 'react';

/**
 * Heavy modelers are code-split: each import() becomes its own chunk (see vite.config.ts manualChunks),
 * so the dashboard and form screens never download bpmn-js, dmn-js or form-js.
 */
export const LazyProcessViewer = lazy(() => import('./ProcessViewer'));
export const LazyProcessModeler = lazy(() => import('./ProcessModeler'));
export const LazyDecisionTable = lazy(() => import('./DecisionTable'));
export const LazyFormJsEditor = lazy(() => import('./FormJsEditor'));
export const LazyFormJsViewer = lazy(() => import('./FormJsViewer'));
