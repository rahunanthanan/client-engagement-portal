import type {
  FieldSchema,
  FormSchema,
  FormValues,
  HiddenValuePolicy,
  RepeatableFieldSchema,
  RowFieldSchema,
  RowValue,
  SectionSchema,
} from '../schema/types';
import { isInputField } from '../schema/types';
import { buildDependencyGraph, type DependencyGraph } from './dependencies';
import { evaluateCondition, isEmptyValue, type RuleContext } from './rules';

/**
 * Pure functions over (schema, values). React components and Redux reducers call these;
 * they never re-implement visibility or required rules themselves.
 */

export interface SchemaIndex {
  schema: FormSchema;
  fieldsById: Map<string, FieldSchema>;
  sectionByFieldId: Map<string, SectionSchema>;
  graph: DependencyGraph;
}

const indexCache = new WeakMap<FormSchema, SchemaIndex>();

export function indexSchema(schema: FormSchema): SchemaIndex {
  const cached = indexCache.get(schema);
  if (cached) return cached;
  const fieldsById = new Map<string, FieldSchema>();
  const sectionByFieldId = new Map<string, SectionSchema>();
  for (const section of schema.sections) {
    for (const field of section.fields) {
      fieldsById.set(field.id, field);
      sectionByFieldId.set(field.id, section);
    }
  }
  const index = { schema, fieldsById, sectionByFieldId, graph: buildDependencyGraph(schema) };
  indexCache.set(schema, index);
  return index;
}

/* ------------------------------------------------------------------ */
/* Visibility and required rules                                       */
/* ------------------------------------------------------------------ */

export function isSectionVisible(section: SectionSchema, values: FormValues): boolean {
  return !section.visibleWhen || evaluateCondition(section.visibleWhen, { values });
}

export function isFieldVisible(
  field: FieldSchema | RowFieldSchema,
  values: FormValues,
  row?: RowValue,
  section?: SectionSchema,
): boolean {
  if (section && !isSectionVisible(section, values)) return false;
  return !field.visibleWhen || evaluateCondition(field.visibleWhen, { values, row });
}

export function isFieldRequired(field: FieldSchema | RowFieldSchema, ctx: RuleContext): boolean {
  if (!isInputField(field as FieldSchema)) return false;
  const input = field as { required?: boolean; requiredWhen?: Parameters<typeof evaluateCondition>[0] };
  if (input.required) return true;
  return input.requiredWhen ? evaluateCondition(input.requiredWhen, ctx) : false;
}

function effectivePolicy(field: FieldSchema | RowFieldSchema, section?: SectionSchema): HiddenValuePolicy {
  return field.whenHidden ?? section?.whenHidden ?? 'retain';
}

/* ------------------------------------------------------------------ */
/* Initial values                                                      */
/* ------------------------------------------------------------------ */

let rowCounter = 0;
export function createRowId(): string {
  rowCounter += 1;
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : String(rowCounter);
  return `row-${random}-${rowCounter}`;
}

export function createEmptyRow(field: RepeatableFieldSchema): RowValue {
  const row: RowValue = { rowId: createRowId() };
  for (const rowField of field.fields) {
    if ('defaultValue' in rowField && rowField.defaultValue !== undefined) row[rowField.id] = rowField.defaultValue;
  }
  return row;
}

/** Schema defaults, overlaid with existing values (existing always wins). */
export function buildInitialValues(schema: FormSchema, existing: FormValues = {}): FormValues {
  const values: FormValues = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!isInputField(field)) continue;
      if (field.type === 'repeatable') {
        const rows = Array.isArray(existing[field.id]) ? (existing[field.id] as RowValue[]) : [];
        const filled = rows.map((r) => ({ ...r, rowId: r.rowId ?? createRowId() }));
        while (filled.length < (field.minItems ?? 0)) filled.push(createEmptyRow(field));
        values[field.id] = filled;
      } else if (field.id in existing) {
        values[field.id] = existing[field.id];
      } else if ('defaultValue' in field && field.defaultValue !== undefined) {
        values[field.id] = field.defaultValue;
      }
    }
  }
  // Keep unknown keys (e.g. values from a newer schema) so nothing is silently lost.
  for (const [key, value] of Object.entries(existing)) if (!(key in values)) values[key] = value;
  return applyHiddenPolicies(schema, values);
}

/* ------------------------------------------------------------------ */
/* Changes                                                             */
/* ------------------------------------------------------------------ */

export type FieldPath = string | { repeatableId: string; rowId: string; fieldId: string };

export function pathKey(path: FieldPath): string {
  return typeof path === 'string' ? path : `${path.repeatableId}.${path.rowId}.${path.fieldId}`;
}

/**
 * Applies one user change and every consequence of it:
 * 1. dependent API dropdowns are cleared (their options are no longer valid),
 * 2. fields that became hidden are cleared or retained according to their policy.
 */
export function applyFieldChange(schema: FormSchema, values: FormValues, path: FieldPath, value: unknown): FormValues {
  const index = indexSchema(schema);
  let next: FormValues = { ...values };

  if (typeof path === 'string') {
    next[path] = value;
    next = clearDependentDropdowns(index, next, path);
  } else {
    const rows = (next[path.repeatableId] as RowValue[] | undefined) ?? [];
    const repeatable = index.fieldsById.get(path.repeatableId) as RepeatableFieldSchema | undefined;
    next[path.repeatableId] = rows.map((row) => {
      if (row.rowId !== path.rowId) return row;
      let updated: RowValue = { ...row, [path.fieldId]: value };
      if (repeatable) updated = clearDependentRowDropdowns(repeatable, updated, path.fieldId);
      return updated;
    });
  }
  return applyHiddenPolicies(schema, next);
}

function clearDependentDropdowns(index: SchemaIndex, values: FormValues, changedId: string): FormValues {
  const next = { ...values };
  const queue = [changedId];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    for (const field of index.fieldsById.values()) {
      if (field.type !== 'dropdown' || field.options.source !== 'api') continue;
      if (!field.options.dependsOn?.includes(current) || seen.has(field.id)) continue;
      seen.add(field.id);
      if (!isEmptyValue(next[field.id])) delete next[field.id];
      queue.push(field.id);
    }
  }
  return next;
}

function clearDependentRowDropdowns(repeatable: RepeatableFieldSchema, row: RowValue, changedId: string): RowValue {
  const next = { ...row };
  for (const field of repeatable.fields) {
    if (field.type === 'dropdown' && field.options.source === 'api' && field.options.dependsOn?.includes(`row.${changedId}`)) {
      delete next[field.id];
    }
  }
  return next;
}

/** Clears hidden values whose policy is "clear". Iterates to a fixed point because clearing can hide more fields. */
export function applyHiddenPolicies(schema: FormSchema, values: FormValues): FormValues {
  let current = values;
  for (let pass = 0; pass < 10; pass += 1) {
    let changed = false;
    const next: FormValues = { ...current };
    for (const section of schema.sections) {
      for (const field of section.fields) {
        if (!isInputField(field)) continue;
        const visible = isFieldVisible(field, current, undefined, section);
        if (!visible && effectivePolicy(field, section) === 'clear' && !isEmptyValue(current[field.id])) {
          delete next[field.id];
          changed = true;
          continue;
        }
        if (field.type === 'repeatable' && Array.isArray(current[field.id])) {
          const rows = current[field.id] as RowValue[];
          const newRows = rows.map((row) => {
            let rowChanged = false;
            const newRow = { ...row };
            for (const rowField of field.fields) {
              if (!isFieldVisible(rowField, current, row) && effectivePolicy(rowField) === 'clear' && !isEmptyValue(row[rowField.id])) {
                delete newRow[rowField.id];
                rowChanged = true;
              }
            }
            return rowChanged ? newRow : row;
          });
          if (newRows.some((r, i) => r !== rows[i])) {
            next[field.id] = newRows;
            changed = true;
          }
        }
      }
    }
    if (!changed) return current;
    current = next;
  }
  return current;
}

/** Strips values of hidden fields from a submission payload (whatever their policy). */
export function visibleValuesOnly(schema: FormSchema, values: FormValues): FormValues {
  const out: FormValues = {};
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!isInputField(field) || !isFieldVisible(field, values, undefined, section)) continue;
      if (values[field.id] !== undefined) out[field.id] = values[field.id];
    }
  }
  return out;
}
