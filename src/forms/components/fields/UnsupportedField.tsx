import { Alert } from '@mui/material';

/** Rendered instead of crashing when a schema contains a type this build does not support. */
export function UnsupportedField({ field }: { field: { id: string; type: string; label?: string } }) {
  return (
    <Alert severity="warning" variant="outlined" data-testid={`unsupported-${field.id}`}>
      Field “{field.label ?? field.id}” uses type “{field.type}”, which this version of the portal cannot display.
    </Alert>
  );
}
