import { Alert, Checkbox, Divider, FormControl, FormControlLabel, FormHelperText, Switch, TextField, Typography } from '@mui/material';
import type {
  AlertFieldSchema,
  CheckboxFieldSchema,
  DateFieldSchema,
  DividerFieldSchema,
  NumberFieldSchema,
  ReadOnlyFieldSchema,
  TextFieldSchema,
  TextareaFieldSchema,
  ToggleFieldSchema,
} from '../../schema/types';
import { useAppSelector } from '@/app/store';
import { useFormEngine } from '../FormEngineContext';
import type { FieldProps } from './types';

/**
 * Small, reusable field components. They are deliberately "dumb": value, error and handlers come
 * from FieldRenderer, which owns subscriptions. Text is always rendered as text (no HTML).
 */

const helper = (error: string | undefined, help: string | undefined) => error ?? help;

export function TextInput({ field, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<TextFieldSchema | TextareaFieldSchema>) {
  const multiline = field.type === 'textarea';
  return (
    <TextField
      id={domId}
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      onBlur={onBlur}
      required={required}
      error={!!error}
      helperText={helper(error, field.helpText)}
      placeholder={field.type === 'text' ? field.placeholder : undefined}
      multiline={multiline}
      minRows={multiline ? (field.rows ?? 3) : undefined}
      slotProps={{ input: { readOnly }, htmlInput: { maxLength: field.validation?.maxLength } }}
      fullWidth
      size="small"
    />
  );
}

export function NumberInput({ field, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<NumberFieldSchema>) {
  return (
    <TextField
      id={domId}
      type="number"
      label={field.unit ? `${field.label} (${field.unit})` : field.label}
      value={typeof value === 'number' ? String(value) : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      onBlur={onBlur}
      required={required}
      error={!!error}
      helperText={helper(error, field.helpText)}
      slotProps={{ input: { readOnly }, htmlInput: { min: field.validation?.min, max: field.validation?.max, inputMode: 'decimal' } }}
      fullWidth
      size="small"
    />
  );
}

export function DateInput({ field, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<DateFieldSchema>) {
  return (
    <TextField
      id={domId}
      type="date"
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      onBlur={onBlur}
      required={required}
      error={!!error}
      helperText={helper(error, field.helpText)}
      slotProps={{ inputLabel: { shrink: true }, input: { readOnly } }}
      fullWidth
      size="small"
    />
  );
}

export function CheckboxInput({ field, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<CheckboxFieldSchema | ToggleFieldSchema>) {
  const Control = field.type === 'toggle' ? Switch : Checkbox;
  return (
    <FormControl error={!!error} required={required}>
      <FormControlLabel
        control={
          <Control
            id={domId}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={readOnly}
            slotProps={{ input: { 'aria-describedby': error || field.helpText ? `${domId}-help` : undefined } }}
          />
        }
        label={`${field.label}${required ? ' *' : ''}`}
      />
      {(error || field.helpText) && <FormHelperText id={`${domId}-help`}>{helper(error, field.helpText)}</FormHelperText>}
    </FormControl>
  );
}

export function ReadOnlyDisplay({ field }: FieldProps<ReadOnlyFieldSchema>) {
  const { context, api } = useFormEngine();
  const fieldSource = 'field' in field.source ? field.source.field : null;
  const fromField = useAppSelector((s) => (fieldSource ? s.forms[api.formId]?.values[fieldSource] : undefined));
  const display = 'context' in field.source ? context[field.source.context] : fromField;
  return (
    <div>
      <Typography variant="caption" color="text.secondary" component="div">
        {field.label}
      </Typography>
      <Typography variant="body1">{display === undefined || display === null || display === '' ? '—' : String(display)}</Typography>
    </div>
  );
}

export function AlertDisplay({ field }: FieldProps<AlertFieldSchema>) {
  return (
    <Alert severity={field.severity} variant="outlined">
      <strong>{field.label}.</strong> {field.message}
    </Alert>
  );
}

export function DividerDisplay({ field }: FieldProps<DividerFieldSchema>) {
  return (
    <Divider textAlign="left" sx={{ my: 1 }}>
      {field.label}
    </Divider>
  );
}
