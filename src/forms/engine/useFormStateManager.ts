import { useMemo } from 'react';
import { useStore } from 'react-redux';
import type { RootState } from '@/app/store';
import { useAppDispatch } from '@/app/store';
import type { FieldErrors, FormSchema, FormValues, RepeatableFieldSchema, RowValue, ValidationMode } from '../schema/types';
import { applyFieldChange, createEmptyRow, indexSchema, isFieldRequired, pathKey, type FieldPath } from './formModel';
import {
  fieldErrorsPatched,
  fieldTouched,
  formReset,
  formValuesChanged,
  serverErrorsApplied,
  validationApplied,
} from './formsSlice';
import { validateFieldValue, validateForm, type FormValidationResult } from './validation';

/**
 * Typed imperative API over one form instance.
 *
 * Reads go through `store.getState()` so calling them never subscribes or re-renders the
 * caller. Components that DISPLAY a value subscribe to just that value via the hooks in
 * `formSelectors.ts` (isolated field subscriptions).
 */
export interface FormApi {
  readonly formId: string;
  readonly schema: FormSchema;
  getValues(): FormValues;
  getValue(path: FieldPath): unknown;
  setValue(path: FieldPath, value: unknown): void;
  validate(mode: ValidationMode): FormValidationResult;
  validateField(path: FieldPath): string | undefined;
  touch(path: FieldPath): void;
  reset(values: FormValues): void;
  setServerErrors(fieldErrors: FieldErrors, formErrors?: string[]): void;
  addRow(repeatableId: string): void;
  removeRow(repeatableId: string, rowId: string): void;
}

export function useFormStateManager(formId: string, schema: FormSchema): FormApi {
  const dispatch = useAppDispatch();
  const store = useStore<RootState>();

  return useMemo<FormApi>(() => {
    const index = indexSchema(schema);
    const current = () => store.getState().forms[formId];
    const getValues = () => current()?.values ?? {};

    const readPath = (path: FieldPath): unknown => {
      const values = getValues();
      if (typeof path === 'string') return values[path];
      const rows = (values[path.repeatableId] as RowValue[] | undefined) ?? [];
      return rows.find((r) => r.rowId === path.rowId)?.[path.fieldId];
    };

    const validateField = (path: FieldPath): string | undefined => {
      const values = getValues();
      const mode = current()?.validationMode ?? 'draft';
      let message: string | undefined;
      if (typeof path === 'string') {
        const field = index.fieldsById.get(path);
        if (field) message = validateFieldValue(field, values[path], isFieldRequired(field, { values }), mode);
      } else {
        const repeatable = index.fieldsById.get(path.repeatableId) as RepeatableFieldSchema | undefined;
        const field = repeatable?.fields.find((f) => f.id === path.fieldId);
        const row = ((values[path.repeatableId] as RowValue[] | undefined) ?? []).find((r) => r.rowId === path.rowId);
        if (field && row) message = validateFieldValue(field, row[field.id], isFieldRequired(field, { values, row }), mode);
      }
      dispatch(fieldErrorsPatched({ formId, patch: { [pathKey(path)]: message } }));
      return message;
    };

    const api: FormApi = {
      formId,
      schema,
      getValues,
      getValue: readPath,
      setValue(path, value) {
        const next = applyFieldChange(schema, getValues(), path, value);
        dispatch(formValuesChanged({ formId, values: next, changedPath: pathKey(path) }));
        // Re-validate only fields that already show an error, so users are not nagged while typing.
        if (current()?.errors[pathKey(path)]) validateField(path);
      },
      validate(mode) {
        const result = validateForm(schema, getValues(), mode);
        dispatch(validationApplied({ formId, mode, errors: result.fieldErrors, sectionErrors: result.sectionErrors, formErrors: result.formErrors }));
        return result;
      },
      validateField,
      touch(path) {
        dispatch(fieldTouched({ formId, path: pathKey(path) }));
        validateField(path);
      },
      reset(values) {
        dispatch(formReset({ formId, values }));
      },
      setServerErrors(fieldErrors, formErrors = []) {
        dispatch(serverErrorsApplied({ formId, fieldErrors, formErrors }));
      },
      addRow(repeatableId) {
        const field = index.fieldsById.get(repeatableId) as RepeatableFieldSchema | undefined;
        if (!field) return;
        const rows = (getValues()[repeatableId] as RowValue[] | undefined) ?? [];
        if (field.maxItems && rows.length >= field.maxItems) return;
        api.setValue(repeatableId, [...rows, createEmptyRow(field)]);
      },
      removeRow(repeatableId, rowId) {
        const rows = (getValues()[repeatableId] as RowValue[] | undefined) ?? [];
        api.setValue(
          repeatableId,
          rows.filter((r) => r.rowId !== rowId),
        );
      },
    };
    return api;
  }, [dispatch, store, formId, schema]);
}
