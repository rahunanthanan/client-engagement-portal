import { memo, useCallback, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { Alert, AlertTitle, Box, Link, List, ListItem } from '@mui/material';
import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/app/store';
import { indexSchema } from '../engine/formModel';
import { useFormStateManager, type FormApi } from '../engine/useFormStateManager';
import type { FormContext, FormSchema, RepeatableFieldSchema, RowValue } from '../schema/types';
import { validateSchema } from '../schema/validateSchema';
import { SUPPORTED_FIELD_TYPES } from './fieldRegistry';
import { domIdFor, FormEngineContext } from './FormEngineContext';
import { FormSection } from './FormSection';

export interface DynamicFormProps {
  formId: string;
  schema: FormSchema;
  context: FormContext;
  readOnly?: boolean;
  /** React 19: `ref` is a normal prop for function components (no forwardRef). Exposes the typed form API. */
  ref?: Ref<FormApi>;
}

const BLOCKING = new Set(['CIRCULAR_DEPENDENCY', 'DUPLICATE_ID', 'UNKNOWN_REFERENCE', 'MISSING_HIDDEN_POLICY', 'INVALID_ROW_REFERENCE']);

/**
 * Renders a versioned schema. The schema is data; this component only orchestrates sections.
 * The form's state must already be initialised in the store (see RequestDetails / hydration).
 */
export const DynamicForm = memo(function DynamicForm({ formId, schema, context, readOnly = false, ref }: DynamicFormProps) {
  const check = useMemo(() => validateSchema(schema, SUPPORTED_FIELD_TYPES), [schema]);
  const api = useFormStateManager(formId, schema);
  useImperativeHandle(ref, () => api, [api]);

  const initialised = useAppSelector((s) => formId in s.forms);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(schema.sections.filter((s) => s.defaultExpanded !== false).map((s) => s.id)),
  );
  const onToggle = useCallback((sectionId: string, isExpanded: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (isExpanded) next.add(sectionId);
      else next.delete(sectionId);
      return next;
    });
  }, []);

  const engineContext = useMemo(() => ({ api, context, readOnly }), [api, context, readOnly]);

  const blocking = check.issues.filter((i) => BLOCKING.has(i.code));
  if (blocking.length) {
    return (
      <Alert severity="error" role="alert">
        <AlertTitle>This form definition cannot be displayed</AlertTitle>
        <List dense>
          {blocking.map((issue) => (
            <ListItem key={`${issue.code}-${issue.fieldId}`}>{issue.message}</ListItem>
          ))}
        </List>
      </Alert>
    );
  }
  if (!initialised) return null;

  return (
    <FormEngineContext.Provider value={engineContext}>
      <ErrorSummary
        schema={schema}
        formId={formId}
        onNavigate={(sectionId) => onToggle(sectionId, true)}
      />
      <Box component="form" noValidate aria-label={schema.title} onSubmit={(e) => e.preventDefault()}>
        {schema.sections.map((section) => (
          <FormSection key={section.id} section={section} expanded={expanded.has(section.id)} onToggle={onToggle} />
        ))}
      </Box>
    </FormEngineContext.Provider>
  );
});

/**
 * Accessible error summary (GOV.UK pattern): appears after a submit attempt or server validation,
 * receives focus, and every entry links to the field it describes.
 */
function ErrorSummary({ schema, formId, onNavigate }: { schema: FormSchema; formId: string; onNavigate: (sectionId: string) => void }) {
  const state = useAppSelector(
    (s) => {
      const form = s.forms[formId];
      return {
        show: !!form && (form.validationMode === 'submit' || form.serverErrorPaths.length > 0),
        errors: form?.errors,
        sectionErrors: form?.sectionErrors,
        formErrors: form?.formErrors,
        values: form?.values,
      };
    },
    shallowEqual,
  );
  const index = indexSchema(schema);
  if (!state.show || !state.errors) return null;
  const fieldEntries = Object.entries(state.errors);
  const sectionEntries = Object.entries(state.sectionErrors ?? {});
  const formErrors = state.formErrors ?? [];
  if (!fieldEntries.length && !sectionEntries.length && !formErrors.length) return null;

  const labelFor = (path: string): { label: string; sectionId?: string } => {
    const [topId, rowId, rowFieldId] = path.split('.');
    const top = index.fieldsById.get(topId!);
    const sectionId = index.sectionByFieldId.get(topId!)?.id;
    if (top?.type === 'repeatable' && rowId && rowFieldId) {
      const rows = (state.values?.[top.id] as RowValue[] | undefined) ?? [];
      const n = rows.findIndex((r) => r.rowId === rowId) + 1;
      const rowField = (top as RepeatableFieldSchema).fields.find((f) => f.id === rowFieldId);
      return { label: `${top.itemLabel} ${n}: ${rowField?.label ?? rowFieldId}`, sectionId };
    }
    return { label: top?.label ?? path, sectionId };
  };

  const goTo = (path: string, sectionId?: string) => {
    if (sectionId) onNavigate(sectionId);
    requestAnimationFrame(() => {
      const el = document.getElementById(domIdFor(path));
      el?.focus();
      el?.scrollIntoView?.({ block: 'center' });
    });
  };

  return (
    <Alert severity="error" id="error-summary" tabIndex={-1} role="alert" aria-labelledby="error-summary-title" sx={{ mb: 2 }}>
      <AlertTitle id="error-summary-title">There is a problem</AlertTitle>
      <List dense disablePadding>
        {formErrors.map((message) => (
          <ListItem key={message} disableGutters>
            {message}
          </ListItem>
        ))}
        {sectionEntries.flatMap(([sectionId, messages]) =>
          messages.map((message) => (
            <ListItem key={`${sectionId}-${message}`} disableGutters>
              {message}
            </ListItem>
          )),
        )}
        {fieldEntries.map(([path, message]) => {
          const { label, sectionId } = labelFor(path);
          return (
            <ListItem key={path} disableGutters>
              <Link
                component="button"
                type="button"
                onClick={() => goTo(path, sectionId)}
                sx={{ textAlign: 'left' }}
              >
                {label}: {message}
              </Link>
            </ListItem>
          );
        })}
      </List>
    </Alert>
  );
}
