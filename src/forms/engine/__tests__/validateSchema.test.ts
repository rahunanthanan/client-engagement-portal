import type { FormSchema } from '@/forms/schema/types';
import { validateSchema } from '@/forms/schema/validateSchema';
import { SCHEMAS } from '@/mocks/schemas';
import { testSchema } from '@/test/fixtures';
import { buildDependencyGraph, findCycle, topologicalOrder } from '../dependencies';

const SUPPORTED = new Set(['text', 'textarea', 'number', 'date', 'dropdown', 'checkbox', 'toggle', 'search', 'readonly', 'alert', 'divider', 'attachment', 'repeatable']);

const withFields = (fields: unknown[]): FormSchema => ({
  ...testSchema,
  sections: [{ id: 's', title: 'S', fields: fields as FormSchema['sections'][number]['fields'] }],
});

describe('validateSchema', () => {
  it.each(SCHEMAS.map((s) => [`${s.schemaId}@${s.version}`, s] as const))('sample schema %s is valid', (_name, schema) => {
    expect(validateSchema(schema, SUPPORTED).issues).toEqual([]);
  });

  it('detects circular dependencies and reports the path', () => {
    const schema = withFields([
      { id: 'a', type: 'text', label: 'A', visibleWhen: { field: 'c', op: 'isNotEmpty' }, whenHidden: 'clear' },
      { id: 'b', type: 'text', label: 'B', visibleWhen: { field: 'a', op: 'isNotEmpty' }, whenHidden: 'clear' },
      { id: 'c', type: 'dropdown', label: 'C', options: { source: 'api', lookup: 'x', dependsOn: ['b'] } },
    ]);
    const result = validateSchema(schema, SUPPORTED);
    const issue = result.issues.find((i) => i.code === 'CIRCULAR_DEPENDENCY');
    expect(issue?.message).toMatch(/a → b → c → a/);
    expect(findCycle(buildDependencyGraph(schema))).not.toBeNull();
    expect(() => topologicalOrder(buildDependencyGraph(schema))).toThrow(/cycle/);
  });

  it('reports unsupported field types, unknown references and missing hidden policies', () => {
    const schema = withFields([
      { id: 'sig', type: 'signature', label: 'Signature' },
      { id: 'x', type: 'text', label: 'X', visibleWhen: { field: 'nope', op: 'isTrue' } },
      { id: 'x', type: 'text', label: 'Duplicate' },
    ]);
    const codes = validateSchema(schema, SUPPORTED).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['UNSUPPORTED_FIELD_TYPE', 'UNKNOWN_REFERENCE', 'MISSING_HIDDEN_POLICY', 'DUPLICATE_ID']));
  });

  it('orders dependencies before dependents', () => {
    const order = topologicalOrder(buildDependencyGraph(testSchema));
    expect(order.indexOf('country')).toBeLessThan(order.indexOf('region'));
  });
});
