import { buildDependencyGraph, fieldDependencies, findCycle } from '../engine/dependencies';
import { collectRefs, isRowRef } from '../engine/rules';
import type { FieldSchema, FormSchema } from './types';
import { isInputField } from './types';

/**
 * Structural checks run on every schema before rendering (and in CI against sample schemas).
 * Schemas arrive as JSON, so the TypeScript union alone cannot guarantee correctness.
 */

export type SchemaIssueCode =
  | 'DUPLICATE_ID'
  | 'UNSUPPORTED_FIELD_TYPE'
  | 'UNKNOWN_REFERENCE'
  | 'MISSING_HIDDEN_POLICY'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_ROW_REFERENCE';

export interface SchemaIssue {
  code: SchemaIssueCode;
  message: string;
  fieldId?: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  issues: SchemaIssue[];
}

export function validateSchema(schema: FormSchema, supportedTypes: ReadonlySet<string>): SchemaValidationResult {
  const issues: SchemaIssue[] = [];
  const topLevelIds = new Set<string>();

  const checkField = (field: FieldSchema, scope: { repeatableId?: string; rowIds?: Set<string> }) => {
    if (!supportedTypes.has(field.type)) {
      issues.push({
        code: 'UNSUPPORTED_FIELD_TYPE',
        fieldId: field.id,
        message: `Field "${field.id}" uses unsupported type "${String(field.type)}".`,
      });
    }
    const conditional = field.visibleWhen !== undefined;
    if (conditional && isInputField(field) && field.whenHidden === undefined) {
      issues.push({
        code: 'MISSING_HIDDEN_POLICY',
        fieldId: field.id,
        message: `Conditional field "${field.id}" must declare whenHidden: "clear" | "retain".`,
      });
    }
    for (const ref of fieldDependencies(field)) {
      if (isRowRef(ref)) {
        if (!scope.rowIds?.has(ref.slice(4))) {
          issues.push({
            code: 'INVALID_ROW_REFERENCE',
            fieldId: field.id,
            message: `Field "${field.id}" references "${ref}" outside a repeatable row.`,
          });
        }
      } else if (!topLevelIds.has(ref)) {
        issues.push({
          code: 'UNKNOWN_REFERENCE',
          fieldId: field.id,
          message: `Field "${field.id}" references unknown field "${ref}".`,
        });
      }
    }
  };

  // First pass: collect ids and duplicates.
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (topLevelIds.has(field.id)) {
        issues.push({ code: 'DUPLICATE_ID', fieldId: field.id, message: `Duplicate field id "${field.id}".` });
      }
      topLevelIds.add(field.id);
    }
  }

  // Second pass: references and policies.
  for (const section of schema.sections) {
    if (section.visibleWhen && section.whenHidden === undefined) {
      issues.push({
        code: 'MISSING_HIDDEN_POLICY',
        fieldId: section.id,
        message: `Conditional section "${section.id}" must declare whenHidden: "clear" | "retain".`,
      });
    }
    for (const ref of collectRefs(section.visibleWhen)) {
      if (!topLevelIds.has(ref)) {
        issues.push({ code: 'UNKNOWN_REFERENCE', fieldId: section.id, message: `Section "${section.id}" references unknown field "${ref}".` });
      }
    }
    for (const field of section.fields) {
      checkField(field, {});
      if (field.type === 'repeatable') {
        const rowIds = new Set(field.fields.map((f) => f.id));
        field.fields.forEach((rowField) => checkField(rowField, { repeatableId: field.id, rowIds }));
      }
    }
  }

  const cycle = findCycle(buildDependencyGraph(schema));
  if (cycle) {
    issues.push({
      code: 'CIRCULAR_DEPENDENCY',
      fieldId: cycle[0],
      message: `Circular dependency: ${cycle.join(' → ')}.`,
    });
  }

  return { valid: issues.length === 0, issues };
}
