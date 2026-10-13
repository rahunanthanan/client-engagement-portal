import type { LookupOption } from '@/api/contracts';
import type { DropdownFieldSchema, FormSchema, FormValues } from '../schema/types';
import { buildInitialValues, indexSchema } from './formModel';
import { topologicalOrder } from './dependencies';
import { isEmptyValue } from './rules';

/**
 * Prepares an existing (or new) request for editing.
 *
 * 1. Merges schema defaults with stored values (stored values win).
 * 2. Walks API-driven dropdowns in dependency order (parent before child) and pre-loads
 *    their options, so a reopened draft shows "Country: Canada / Region: Ontario"
 *    immediately instead of flashing empty dropdowns.
 * 3. Drops stored values that are no longer valid options (e.g. a retired region) and
 *    reports them as warnings so the user can re-select.
 *
 * `loadOptions` is injected; the app passes a function backed by TanStack Query's
 * `fetchQuery`, which means the cache is warm when the dropdown components mount.
 */

export interface HydrationResult {
  values: FormValues;
  options: Record<string, LookupOption[]>;
  warnings: string[];
}

export type OptionLoader = (lookup: string, parent: string | undefined) => Promise<LookupOption[]>;

export function parentKey(field: DropdownFieldSchema, values: FormValues): string | undefined | null {
  if (field.options.source !== 'api' || !field.options.dependsOn?.length) return undefined;
  const parts = field.options.dependsOn.map((ref) => values[ref]);
  if (parts.some(isEmptyValue)) return null; // parent not chosen yet: no options to load
  return parts.map(String).join(',');
}

export async function hydrateFormWithDependencies(
  schema: FormSchema,
  storedValues: FormValues,
  loadOptions: OptionLoader,
): Promise<HydrationResult> {
  const index = indexSchema(schema);
  const values = buildInitialValues(schema, storedValues);
  const options: Record<string, LookupOption[]> = {};
  const warnings: string[] = [];

  const order = topologicalOrder(index.graph);
  for (const fieldId of order) {
    const field = index.fieldsById.get(fieldId);
    if (!field || field.type !== 'dropdown' || field.options.source !== 'api') continue;

    const parent = parentKey(field, values);
    if (parent === null) {
      if (!isEmptyValue(values[field.id])) {
        warnings.push(`${field.label} was cleared because its parent field is empty.`);
        delete values[field.id];
      }
      continue;
    }

    const loaded = await loadOptions(field.options.lookup, parent);
    options[field.id] = loaded;
    const current = values[field.id];
    if (!isEmptyValue(current) && !loaded.some((o) => o.value === current)) {
      warnings.push(`${field.label} "${String(current)}" is no longer available. Please choose again.`);
      delete values[field.id];
    }
  }

  return { values, options, warnings };
}
