import type { Condition, FieldRef, FormValues, RowValue } from '../schema/types';

export interface RuleContext {
  values: FormValues;
  row?: RowValue;
}

const ROW_PREFIX = 'row.';

export function isRowRef(ref: FieldRef): boolean {
  return ref.startsWith(ROW_PREFIX);
}

export function resolveRef(ref: FieldRef, ctx: RuleContext): unknown {
  if (isRowRef(ref)) return ctx.row?.[ref.slice(ROW_PREFIX.length)];
  return ctx.values[ref];
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Search values are `{ id, label }`; compare on id so rules can stay simple. */
function comparable(value: unknown): unknown {
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: unknown }).id;
  return value;
}

export function evaluateCondition(condition: Condition, ctx: RuleContext): boolean {
  if ('all' in condition) return condition.all.every((c) => evaluateCondition(c, ctx));
  if ('any' in condition) return condition.any.some((c) => evaluateCondition(c, ctx));
  if ('not' in condition) return !evaluateCondition(condition.not, ctx);

  const actual = comparable(resolveRef(condition.field, ctx));
  switch (condition.op) {
    case 'equals':
      return actual === condition.value;
    case 'notEquals':
      return actual !== condition.value;
    case 'in':
      return condition.value.includes(actual as string | number);
    case 'notIn':
      return !condition.value.includes(actual as string | number);
    case 'isEmpty':
      return isEmptyValue(actual);
    case 'isNotEmpty':
      return !isEmptyValue(actual);
    case 'isTrue':
      return actual === true;
    case 'isFalse':
      return actual !== true;
    case 'gt':
      return typeof actual === 'number' && actual > condition.value;
    case 'gte':
      return typeof actual === 'number' && actual >= condition.value;
    case 'lt':
      return typeof actual === 'number' && actual < condition.value;
    case 'lte':
      return typeof actual === 'number' && actual <= condition.value;
  }
}

/** Every field reference used by a condition (used for dependency graphs and subscriptions). */
export function collectRefs(condition: Condition | undefined, into: Set<FieldRef> = new Set()): Set<FieldRef> {
  if (!condition) return into;
  if ('all' in condition) condition.all.forEach((c) => collectRefs(c, into));
  else if ('any' in condition) condition.any.forEach((c) => collectRefs(c, into));
  else if ('not' in condition) collectRefs(condition.not, into);
  else into.add(condition.field);
  return into;
}
