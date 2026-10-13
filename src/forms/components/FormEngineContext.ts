import { createContext, useContext } from 'react';
import type { FormContext } from '../schema/types';
import type { FormApi } from '../engine/useFormStateManager';

export interface FormEngineContextValue {
  api: FormApi;
  context: FormContext;
  readOnly: boolean;
}

export const FormEngineContext = createContext<FormEngineContextValue | null>(null);

export function useFormEngine(): FormEngineContextValue {
  const value = useContext(FormEngineContext);
  if (!value) throw new Error('useFormEngine must be used inside <DynamicForm>');
  return value;
}

/** Stable DOM id for a field path, used by labels, error summary links and focus management. */
export function domIdFor(pathKey: string): string {
  return `field-${pathKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
