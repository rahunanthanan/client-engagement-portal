import type {
  AttachmentValue,
  FieldErrors,
  FieldSchema,
  FormSchema,
  FormValues,
  RowFieldSchema,
  RowValue,
  ValidationMode,
} from '../schema/types';
import { isInputField } from '../schema/types';
import { isFieldRequired, isFieldVisible } from './formModel';
import { isEmptyValue } from './rules';
import { sectionValidators, submitValidators } from './validators';

/**
 * Three validation levels:
 * - field:      format rules always; required rules only in "submit" mode,
 * - section:    named cross-field validators declared on a section,
 * - submission: named validators that only make sense for a complete request.
 *
 * "draft" mode lets an incomplete request be saved: nothing is required, but values
 * that ARE present must still be well-formed.
 */

export interface FormValidationResult {
  valid: boolean;
  fieldErrors: FieldErrors;
  sectionErrors: Record<string, string[]>;
  formErrors: string[];
}

const today = () => new Date().toISOString().slice(0, 10);

export function validateFieldValue(
  field: FieldSchema | RowFieldSchema,
  value: unknown,
  required: boolean,
  mode: ValidationMode,
): string | undefined {
  if (isEmptyValue(value) || value === false) {
    if (required && mode === 'submit') {
      return field.type === 'checkbox' || field.type === 'toggle' ? `${field.label} must be confirmed.` : `${field.label} is required.`;
    }
    return undefined;
  }

  switch (field.type) {
    case 'text': {
      const text = String(value);
      const v = field.validation;
      if (v?.minLength && text.length < v.minLength) return `${field.label} must be at least ${v.minLength} characters.`;
      if (v?.maxLength && text.length > v.maxLength) return `${field.label} must be ${v.maxLength} characters or fewer.`;
      if (v?.pattern && !new RegExp(v.pattern).test(text)) return v.patternMessage ?? `${field.label} has an invalid format.`;
      return undefined;
    }
    case 'textarea': {
      const max = field.validation?.maxLength;
      return max && String(value).length > max ? `${field.label} must be ${max} characters or fewer.` : undefined;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) return `${field.label} must be a number.`;
      const v = field.validation;
      if (v?.integer && !Number.isInteger(value)) return `${field.label} must be a whole number.`;
      if (v?.min !== undefined && value < v.min) return `${field.label} must be at least ${v.min}.`;
      if (v?.max !== undefined && value > v.max) return `${field.label} must be ${v.max} or less.`;
      return undefined;
    }
    case 'date': {
      const text = String(value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) return `${field.label} must be a valid date.`;
      if (field.validation?.notInFuture && text > today()) return `${field.label} cannot be in the future.`;
      if (field.validation?.notInPast && text < today()) return `${field.label} cannot be in the past.`;
      return undefined;
    }
    case 'attachment': {
      const files = value as AttachmentValue[];
      if (files.length > field.maxFiles) return `Attach no more than ${field.maxFiles} files.`;
      return undefined;
    }
    case 'repeatable': {
      const rows = value as RowValue[];
      if (mode === 'submit' && field.minItems && rows.length < field.minItems) return `Add at least ${field.minItems} ${field.itemLabel.toLowerCase()}.`;
      if (field.maxItems && rows.length > field.maxItems) return `Add no more than ${field.maxItems} ${field.itemLabel.toLowerCase()} entries.`;
      return undefined;
    }
    default:
      return undefined;
  }
}

export function validateForm(schema: FormSchema, values: FormValues, mode: ValidationMode): FormValidationResult {
  const fieldErrors: FieldErrors = {};
  const sectionErrors: Record<string, string[]> = {};
  const formErrors: string[] = [];

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!isInputField(field) || !isFieldVisible(field, values, undefined, section)) continue;
      const error = validateFieldValue(field, values[field.id], isFieldRequired(field, { values }), mode);
      if (error) fieldErrors[field.id] = error;

      if (field.type === 'repeatable' && Array.isArray(values[field.id])) {
        for (const row of values[field.id] as RowValue[]) {
          for (const rowField of field.fields) {
            if (!isFieldVisible(rowField, values, row)) continue;
            const rowError = validateFieldValue(rowField, row[rowField.id], isFieldRequired(rowField, { values, row }), mode);
            if (rowError) fieldErrors[`${field.id}.${row.rowId}.${rowField.id}`] = rowError;
          }
        }
      }
    }

    // Section validators are cross-field rules about values the user has entered, so they run in both modes.
    const messages = (section.validators ?? []).map((name) => sectionValidators[name](values, mode)).filter((m): m is string => !!m);
    if (messages.length) sectionErrors[section.id] = messages;
  }

  if (mode === 'submit') {
    for (const name of schema.submitValidators ?? []) {
      const message = submitValidators[name](values, mode);
      if (message) formErrors.push(message);
    }
  }

  const valid = Object.keys(fieldErrors).length === 0 && Object.keys(sectionErrors).length === 0 && formErrors.length === 0;
  return { valid, fieldErrors, sectionErrors, formErrors };
}
