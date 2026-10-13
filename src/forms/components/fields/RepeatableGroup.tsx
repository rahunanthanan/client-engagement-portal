import { Box, Button, Grid, IconButton, Paper, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useRowIds } from '../../engine/formSelectors';
import type { RepeatableFieldSchema } from '../../schema/types';
import { FieldRenderer } from '../FieldRenderer';
import { useFormEngine } from '../FormEngineContext';
import type { FieldProps } from './types';

/**
 * Repeatable rows (e.g. beneficial owners). Rows are keyed by a stable `rowId`, never by array
 * index, so removing row 1 does not move row 2's errors or focus onto another row.
 */
export function RepeatableGroup({ field, domId, error, readOnly }: FieldProps<RepeatableFieldSchema>) {
  const { api } = useFormEngine();
  const rowIds = useRowIds(api.formId, field.id);
  const atMax = field.maxItems !== undefined && rowIds.length >= field.maxItems;

  return (
    <Box id={domId} tabIndex={-1} component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <Typography component="legend" variant="subtitle1" sx={{ mb: 1 }}>
        {field.label}
      </Typography>
      {field.helpText && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {field.helpText}
        </Typography>
      )}
      <Stack spacing={2}>
        {rowIds.map((rowId, index) => (
          <Paper key={rowId} variant="outlined" sx={{ p: 2 }} data-testid={`row-${field.id}-${index}`}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                {field.itemLabel} {index + 1}
              </Typography>
              {!readOnly && (
                <IconButton aria-label={`Remove ${field.itemLabel.toLowerCase()} ${index + 1}`} onClick={() => api.removeRow(field.id, rowId)} size="small">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Grid container spacing={2}>
              {field.fields.map((rowField) => (
                <FieldRenderer key={rowField.id} field={rowField} repeatableId={field.id} rowId={rowId} />
              ))}
            </Grid>
          </Paper>
        ))}
      </Stack>
      {error && (
        <Typography color="error" variant="body2" role="alert" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}
      {!readOnly && (
        <Button startIcon={<AddIcon />} onClick={() => api.addRow(field.id)} disabled={atMax} sx={{ mt: 1 }}>
          Add {field.itemLabel.toLowerCase()}
        </Button>
      )}
    </Box>
  );
}
