import type { FormSchema, RowValue } from '@/forms/schema/types';
import { testSchema } from '@/test/fixtures';
import { applyFieldChange, buildInitialValues, isFieldVisible, visibleValuesOnly } from '../formModel';
import { evaluateCondition } from '../rules';

describe('conditions', () => {
  it('evaluates nested all/any/not and comparison operators', () => {
    const values = { a: 'X', n: 7, flag: true, list: [] };
    expect(evaluateCondition({ all: [{ field: 'a', op: 'equals', value: 'X' }, { field: 'n', op: 'gt', value: 5 }] }, { values })).toBe(true);
    expect(evaluateCondition({ any: [{ field: 'a', op: 'in', value: ['Y'] }, { field: 'flag', op: 'isTrue' }] }, { values })).toBe(true);
    expect(evaluateCondition({ not: { field: 'list', op: 'isEmpty' } }, { values })).toBe(false);
    expect(evaluateCondition({ field: 'missing', op: 'lte', value: 1 }, { values })).toBe(false);
  });

  it('resolves row-scoped references', () => {
    const row: RowValue = { rowId: 'r1', isController: true };
    expect(evaluateCondition({ field: 'row.isController', op: 'isTrue' }, { values: {}, row })).toBe(true);
  });
});

describe('conditional fields and hidden-value policies', () => {
  const field = (id: string) => testSchema.sections[0]!.fields.find((f) => f.id === id)!;

  it('shows a field only when its condition holds', () => {
    expect(isFieldVisible(field('trustRef'), { type: 'TRUST' })).toBe(true);
    expect(isFieldVisible(field('trustRef'), { type: 'CHARITY' })).toBe(false);
  });

  it('clears a hidden value when the policy is "clear"', () => {
    let values = applyFieldChange(testSchema, {}, 'type', 'TRUST');
    values = applyFieldChange(testSchema, values, 'trustRef', 'TR-1');
    values = applyFieldChange(testSchema, values, 'type', 'CHARITY');
    expect(values.trustRef).toBeUndefined();
  });

  it('retains a hidden value when the policy is "retain", but excludes it from submission', () => {
    let values = applyFieldChange(testSchema, {}, 'type', 'CHARITY');
    values = applyFieldChange(testSchema, values, 'charityNo', 'CH-9');
    values = applyFieldChange(testSchema, values, 'type', 'TRUST');
    expect(values.charityNo).toBe('CH-9');
    expect(visibleValuesOnly(testSchema, values).charityNo).toBeUndefined();
  });

  it('clears a dependent dropdown when its parent changes', () => {
    let values = applyFieldChange(testSchema, {}, 'country', 'CA');
    values = applyFieldChange(testSchema, values, 'region', 'CA-ON');
    values = applyFieldChange(testSchema, values, 'country', 'GB');
    expect(values.region).toBeUndefined();
  });

  it('applies row-level conditions independently per row', () => {
    let values = buildInitialValues(testSchema, {
      owners: [
        { rowId: 'a', ownerName: 'One', isController: true, controlNote: 'keeps' },
        { rowId: 'b', ownerName: 'Two', isController: true, controlNote: 'goes' },
      ],
    });
    values = applyFieldChange(testSchema, values, { repeatableId: 'owners', rowId: 'b', fieldId: 'isController' }, false);
    const rows = values.owners as RowValue[];
    expect(rows[0]!.controlNote).toBe('keeps');
    expect(rows[1]!.controlNote).toBeUndefined();
  });
});

describe('buildInitialValues', () => {
  it('applies defaults but never overwrites stored values', () => {
    expect(buildInitialValues(testSchema, {}).amount).toBe(0);
    expect(buildInitialValues(testSchema, { amount: 42 }).amount).toBe(42);
  });

  it('keeps unknown keys from other schema versions', () => {
    expect(buildInitialValues(testSchema, { legacyField: 'x' }).legacyField).toBe('x');
  });

  it('creates minimum repeatable rows with stable ids', () => {
    const schema: FormSchema = {
      ...testSchema,
      sections: [{ ...testSchema.sections[0]!, fields: testSchema.sections[0]!.fields.map((f) => (f.type === 'repeatable' ? { ...f, minItems: 2 } : f)) }],
    };
    const rows = buildInitialValues(schema, {}).owners as RowValue[];
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.rowId)).size).toBe(2);
  });
});
