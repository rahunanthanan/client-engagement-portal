import { memo, useCallback, useEffect, useRef } from 'react';
import { Box, Grid } from '@mui/material';
import { useAppSelector } from '@/app/store';
import { useFieldError, useFieldRules, useFieldValue, useRowFieldValue } from '../engine/formSelectors';
import { pathKey as toPathKey, type FieldPath } from '../engine/formModel';
import type { FieldSchema, RowFieldSchema, SectionSchema } from '../schema/types';
import { renderRegisteredField } from './fieldRegistry';
import { domIdFor, useFormEngine } from './FormEngineContext';

interface FieldRendererProps {
  field: FieldSchema | RowFieldSchema;
  section?: SectionSchema;
  repeatableId?: string;
  rowId?: string;
}

/**
 * Connects one schema field to state. It subscribes only to this field's value, error and
 * visible/required flags; the registered component below it stays presentational.
 */
export const FieldRenderer = memo(function FieldRenderer({ field, section, repeatableId, rowId }: FieldRendererProps) {
  const { api, readOnly } = useFormEngine();
  const path: FieldPath = repeatableId && rowId ? { repeatableId, rowId, fieldId: field.id } : field.id;
  const key = toPathKey(path);

  const topValue = useFieldValue(api.formId, repeatableId ? '' : field.id);
  const rowValue = useRowFieldValue(api.formId, repeatableId ?? '', rowId ?? '', field.id);
  const value = repeatableId ? rowValue : topValue;
  const error = useFieldError(api.formId, key);
  const { visible, required } = useFieldRules(api.formId, field, section, repeatableId, rowId);

  const onChange = useCallback((next: unknown) => api.setValue(repeatableId && rowId ? { repeatableId, rowId, fieldId: field.id } : field.id, next), [api, repeatableId, rowId, field.id]);
  const onBlur = useCallback(() => api.touch(repeatableId && rowId ? { repeatableId, rowId, fieldId: field.id } : field.id), [api, repeatableId, rowId, field.id]);

  if (!visible) return null;

  const width = field.width ?? (field.type === 'repeatable' || field.type === 'alert' || field.type === 'divider' || field.type === 'textarea' ? 12 : 6);
  const fieldReadOnly = readOnly || ('readOnly' in field && field.readOnly === true);

  return (
    <Grid size={{ xs: 12, md: width }} data-field-id={key} sx={{ position: 'relative' }}>
      {renderRegisteredField({
        field: field as FieldSchema,
        path,
        pathKey: key,
        domId: domIdFor(key),
        value,
        error,
        required,
        readOnly: fieldReadOnly,
        onChange,
        onBlur,
      })}
      <RenderCount />
    </Grid>
  );
});

/**
 * Demo aid for "measure before optimising": when enabled from the toolbar, each field shows how many
 * times it has rendered. Implemented with an effect + DOM write so counting does not cause renders.
 */
function RenderCount() {
  const show = useAppSelector((s) => s.ui.showRenderCounts);
  const ref = useRef<HTMLSpanElement>(null);
  const count = useRef(0);
  useEffect(() => {
    count.current += 1;
    if (ref.current) ref.current.textContent = `renders: ${count.current}`;
  });
  if (!show) return null;
  return (
    <Box
      component="span"
      ref={ref}
      aria-hidden
      data-testid="render-count"
      sx={{ position: 'absolute', top: -4, right: 0, fontSize: 10, px: 0.5, bgcolor: 'warning.light', borderRadius: 1 }}
    />
  );
}
