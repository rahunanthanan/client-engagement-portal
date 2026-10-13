/**
 * Typed schema contract for the custom dynamic form engine.
 *
 * Schemas are plain JSON delivered by the (simulated) schema API and are versioned:
 * a request is always rendered with the schema version it was created with.
 * Nothing in this file knows about React — rendering lives in `forms/components`.
 */

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

/**
 * A field reference. Plain ids refer to top-level fields.
 * `row.<fieldId>` refers to a sibling field inside the same repeatable row.
 */
export type FieldRef = string;

export type Comparison =
  | { field: FieldRef; op: 'equals' | 'notEquals'; value: string | number | boolean }
  | { field: FieldRef; op: 'in' | 'notIn'; value: ReadonlyArray<string | number> }
  | { field: FieldRef; op: 'isEmpty' | 'isNotEmpty' | 'isTrue' | 'isFalse' }
  | { field: FieldRef; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number };

export type Condition =
  | Comparison
  | { all: ReadonlyArray<Condition> }
  | { any: ReadonlyArray<Condition> }
  | { not: Condition };

/** What happens to a value when its field becomes hidden. Must be explicit for conditional fields. */
export type HiddenValuePolicy = 'clear' | 'retain';

/* ------------------------------------------------------------------ */
/* Option sources                                                      */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
}

export interface StaticOptionSource {
  source: 'static';
  items: ReadonlyArray<SelectOption>;
}

/** Options loaded from the lookup API. `dependsOn` values are sent as the `parent` query parameter. */
export interface ApiOptionSource {
  source: 'api';
  lookup: string;
  dependsOn?: ReadonlyArray<FieldRef>;
}

export type OptionSource = StaticOptionSource | ApiOptionSource;

/* ------------------------------------------------------------------ */
/* Fields (discriminated union on `type`)                              */
/* ------------------------------------------------------------------ */

interface FieldBase {
  id: string;
  label: string;
  helpText?: string;
  visibleWhen?: Condition;
  whenHidden?: HiddenValuePolicy;
  /** Grid width on desktop (12-column grid). */
  width?: 3 | 4 | 6 | 8 | 12;
}

interface InputFieldBase extends FieldBase {
  required?: boolean;
  requiredWhen?: Condition;
  readOnly?: boolean;
}

export interface TextFieldSchema extends InputFieldBase {
  type: 'text';
  defaultValue?: string;
  placeholder?: string;
  validation?: { minLength?: number; maxLength?: number; pattern?: string; patternMessage?: string };
}

export interface TextareaFieldSchema extends InputFieldBase {
  type: 'textarea';
  defaultValue?: string;
  rows?: number;
  validation?: { maxLength?: number };
}

export interface NumberFieldSchema extends InputFieldBase {
  type: 'number';
  defaultValue?: number;
  unit?: string;
  validation?: { min?: number; max?: number; integer?: boolean };
}

export interface DateFieldSchema extends InputFieldBase {
  type: 'date';
  defaultValue?: string;
  validation?: { notInFuture?: boolean; notInPast?: boolean };
}

export interface DropdownFieldSchema extends InputFieldBase {
  type: 'dropdown';
  defaultValue?: string;
  options: OptionSource;
}

export interface CheckboxFieldSchema extends InputFieldBase {
  type: 'checkbox';
  defaultValue?: boolean;
}

export interface ToggleFieldSchema extends InputFieldBase {
  type: 'toggle';
  defaultValue?: boolean;
}

/** Debounced server-side search; the stored value is `{ id, label }`. */
export interface SearchFieldSchema extends InputFieldBase {
  type: 'search';
  lookup: string;
  minChars?: number;
}

/** Displays a value from request context (for example the selected client) or another field. */
export interface ReadOnlyFieldSchema extends FieldBase {
  type: 'readonly';
  source: { context: 'clientName' | 'clientId' | 'requestId' | 'category' | 'requestType' } | { field: string };
}

export interface AlertFieldSchema extends FieldBase {
  type: 'alert';
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

export interface DividerFieldSchema extends FieldBase {
  type: 'divider';
}

export interface AttachmentFieldSchema extends InputFieldBase {
  type: 'attachment';
  documentType: string;
  accept: ReadonlyArray<'application/pdf' | 'image/png' | 'image/jpeg'>;
  maxSizeMb: number;
  maxFiles: number;
}

/** Fields that may appear inside a repeatable row (no nesting of repeatables or attachments). */
export type RowFieldSchema =
  | TextFieldSchema
  | NumberFieldSchema
  | DateFieldSchema
  | DropdownFieldSchema
  | CheckboxFieldSchema
  | ToggleFieldSchema;

export interface RepeatableFieldSchema extends InputFieldBase {
  type: 'repeatable';
  itemLabel: string;
  minItems?: number;
  maxItems?: number;
  fields: ReadonlyArray<RowFieldSchema>;
}

export type FieldSchema =
  | TextFieldSchema
  | TextareaFieldSchema
  | NumberFieldSchema
  | DateFieldSchema
  | DropdownFieldSchema
  | CheckboxFieldSchema
  | ToggleFieldSchema
  | SearchFieldSchema
  | ReadOnlyFieldSchema
  | AlertFieldSchema
  | DividerFieldSchema
  | AttachmentFieldSchema
  | RepeatableFieldSchema;

export type FieldType = FieldSchema['type'];

/** Field types that hold a value (alert/divider/readonly are display-only). */
export type InputFieldSchema = Exclude<FieldSchema, ReadOnlyFieldSchema | AlertFieldSchema | DividerFieldSchema>;

export const DISPLAY_ONLY_TYPES: ReadonlySet<FieldType> = new Set(['readonly', 'alert', 'divider']);

export function isInputField(field: FieldSchema): field is InputFieldSchema {
  return !DISPLAY_ONLY_TYPES.has(field.type);
}

/* ------------------------------------------------------------------ */
/* Sections and forms                                                  */
/* ------------------------------------------------------------------ */

/** Named validators keep schemas as data (no functions in JSON). Implementations live in `engine/validators.ts`. */
export type SectionValidatorName = 'ownershipNotOver100' | 'ownershipAtLeast25ForController' | 'atLeastOneTaxResidency';
export type SubmitValidatorName = 'highRiskNeedsSourceOfFunds' | 'corporateNeedsOwner';

export interface SectionSchema {
  id: string;
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  visibleWhen?: Condition;
  /** Policy for the section's field values while the whole section is hidden (required with visibleWhen). */
  whenHidden?: HiddenValuePolicy;
  fields: ReadonlyArray<FieldSchema>;
  validators?: ReadonlyArray<SectionValidatorName>;
}

export interface FormSchema {
  schemaId: string;
  version: number;
  category: string;
  requestType: string;
  title: string;
  description?: string;
  sections: ReadonlyArray<SectionSchema>;
  submitValidators?: ReadonlyArray<SubmitValidatorName>;
}

/* ------------------------------------------------------------------ */
/* Values                                                              */
/* ------------------------------------------------------------------ */

export interface SearchValue {
  id: string;
  label: string;
}

export interface AttachmentValue {
  attachmentId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  scanStatus: 'PENDING' | 'CLEAN';
}

export interface RowValue {
  rowId: string;
  [fieldId: string]: unknown;
}

export type FormValues = Record<string, unknown>;

/** Context values available to read-only fields. */
export interface FormContext {
  requestId?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
  requestType?: string;
}

export type ValidationMode = 'draft' | 'submit';

/** Errors keyed by path: `fieldId` or `repeatableId.<rowId>.fieldId`. */
export type FieldErrors = Record<string, string>;
