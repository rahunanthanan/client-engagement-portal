import { newCorrelationId } from '@/api/httpClient';

/**
 * Identifies this browser tab as an editor. The server lets the same editor fast-forward its own
 * concurrent saves, but rejects a save based on a revision written by a different editor (409).
 */
export const editorSessionId = `editor-${newCorrelationId()}`;
