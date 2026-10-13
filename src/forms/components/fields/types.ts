import type { FieldSchema, RowFieldSchema } from '../../schema/types';
import type { FieldPath } from '../../engine/formModel';

/** Props every registered field component receives from FieldRenderer. */
export interface FieldProps<F extends FieldSchema | RowFieldSchema = FieldSchema> {
  field: F;
  path: FieldPath;
  pathKey: string;
  domId: string;
  value: unknown;
  error?: string;
  required: boolean;
  readOnly: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
}
