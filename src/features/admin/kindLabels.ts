import type { DefinitionKind } from '@/api/contracts';

export const KIND_LABELS: Record<DefinitionKind, string> = {
  form: 'Form schema (custom renderer)',
  process: 'Process (BPMN)',
  decision: 'Decision (DMN)',
  formjs: 'Form (form-js)',
};
