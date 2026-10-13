import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { FieldErrors, FormContext, FormValues, ValidationMode } from '../schema/types';

/**
 * Form engine state, keyed by form id (the request id for workspace tabs).
 *
 * Every open request has its own entry, so tabs are isolated by construction:
 * no reducer reads or writes another form's entry.
 *
 * Values are computed by the pure engine (`applyFieldChange`) in `useFormStateManager`;
 * reducers only store results, which keeps them trivial and keeps schema logic testable
 * without Redux.
 */

export interface SchemaRef {
  schemaId: string;
  version: number;
}

export interface FormInstanceState {
  schemaRef: SchemaRef;
  context: FormContext;
  values: FormValues;
  errors: FieldErrors;
  sectionErrors: Record<string, string[]>;
  formErrors: string[];
  touched: Record<string, true>;
  warnings: string[];
  /** "submit" after the first submit attempt: from then on, required rules apply while editing. */
  validationMode: ValidationMode;
  /** Field paths whose error came from the server (cleared when the user edits that field). */
  serverErrorPaths: string[];
}

export type FormsState = Record<string, FormInstanceState>;

const initialState: FormsState = {};

export const formsSlice = createSlice({
  name: 'forms',
  initialState,
  reducers: {
    formInitialized(
      state,
      action: PayloadAction<{ formId: string; schemaRef: SchemaRef; values: FormValues; context: FormContext; warnings?: string[] }>,
    ) {
      const { formId, schemaRef, values, context, warnings } = action.payload;
      state[formId] = {
        schemaRef,
        context,
        values,
        errors: {},
        sectionErrors: {},
        formErrors: [],
        touched: {},
        warnings: warnings ?? [],
        validationMode: 'draft',
        serverErrorPaths: [],
      };
    },
    /** A user edit. `values` is the complete next value object computed by the engine. */
    formValuesChanged(state, action: PayloadAction<{ formId: string; values: FormValues; changedPath: string }>) {
      const form = state[action.payload.formId];
      if (!form) return;
      form.values = action.payload.values;
      if (form.serverErrorPaths.includes(action.payload.changedPath)) {
        delete form.errors[action.payload.changedPath];
        form.serverErrorPaths = form.serverErrorPaths.filter((p) => p !== action.payload.changedPath);
      }
    },
    /** Programmatic replacement that is NOT a user edit (reset, conflict resolution, reload). */
    formReset(state, action: PayloadAction<{ formId: string; values: FormValues }>) {
      const form = state[action.payload.formId];
      if (!form) return;
      form.values = action.payload.values;
      form.errors = {};
      form.sectionErrors = {};
      form.formErrors = [];
      form.touched = {};
      form.validationMode = 'draft';
      form.serverErrorPaths = [];
    },
    fieldErrorsPatched(state, action: PayloadAction<{ formId: string; patch: Record<string, string | undefined> }>) {
      const form = state[action.payload.formId];
      if (!form) return;
      for (const [path, message] of Object.entries(action.payload.patch)) {
        if (message) form.errors[path] = message;
        else delete form.errors[path];
      }
    },
    validationApplied(
      state,
      action: PayloadAction<{
        formId: string;
        mode: ValidationMode;
        errors: FieldErrors;
        sectionErrors: Record<string, string[]>;
        formErrors: string[];
      }>,
    ) {
      const form = state[action.payload.formId];
      if (!form) return;
      form.validationMode = action.payload.mode;
      form.errors = action.payload.errors;
      form.sectionErrors = action.payload.sectionErrors;
      form.formErrors = action.payload.formErrors;
      form.serverErrorPaths = [];
    },
    serverErrorsApplied(state, action: PayloadAction<{ formId: string; fieldErrors: FieldErrors; formErrors: string[] }>) {
      const form = state[action.payload.formId];
      if (!form) return;
      form.errors = { ...form.errors, ...action.payload.fieldErrors };
      form.formErrors = action.payload.formErrors;
      form.serverErrorPaths = Object.keys(action.payload.fieldErrors);
    },
    fieldTouched(state, action: PayloadAction<{ formId: string; path: string }>) {
      const form = state[action.payload.formId];
      if (form) form.touched[action.payload.path] = true;
    },
    warningsDismissed(state, action: PayloadAction<{ formId: string }>) {
      const form = state[action.payload.formId];
      if (form) form.warnings = [];
    },
    formRemoved(state, action: PayloadAction<{ formId: string }>) {
      delete state[action.payload.formId];
    },
    allFormsCleared() {
      return {};
    },
  },
});

export const {
  formInitialized,
  formValuesChanged,
  formReset,
  fieldErrorsPatched,
  validationApplied,
  serverErrorsApplied,
  fieldTouched,
  warningsDismissed,
  formRemoved,
  allFormsCleared,
} = formsSlice.actions;
