import { createElement, type ComponentType, type ReactElement } from 'react';
import type { FieldSchema, FieldType } from '../schema/types';
import { AttachmentInput } from './fields/AttachmentInput';
import {
  AlertDisplay,
  CheckboxInput,
  DateInput,
  DividerDisplay,
  NumberInput,
  ReadOnlyDisplay,
  TextInput,
} from './fields/basicFields';
import { DropdownInput, SearchInput } from './fields/lookupFields';
import { RepeatableGroup } from './fields/RepeatableGroup';
import type { FieldProps } from './fields/types';
import { UnsupportedField } from './fields/UnsupportedField';

/**
 * Field registry: the single place that maps a schema `type` to a component.
 * The mapped type forces an entry for every member of the FieldSchema union, so adding a new
 * field type to the schema without a renderer is a compile error.
 */
export type FieldRegistry = {
  [K in FieldType]: ComponentType<FieldProps<Extract<FieldSchema, { type: K }>>>;
};

export const fieldRegistry: FieldRegistry = {
  text: TextInput,
  textarea: TextInput,
  number: NumberInput,
  date: DateInput,
  dropdown: DropdownInput,
  checkbox: CheckboxInput,
  toggle: CheckboxInput,
  search: SearchInput,
  readonly: ReadOnlyDisplay,
  alert: AlertDisplay,
  divider: DividerDisplay,
  attachment: AttachmentInput,
  repeatable: RepeatableGroup,
};

export const SUPPORTED_FIELD_TYPES: ReadonlySet<string> = new Set(Object.keys(fieldRegistry));

/**
 * Looks up the registered component for a field type and renders it. Unknown types (schemas are
 * runtime JSON) render a visible placeholder instead of crashing the whole form.
 */
export function renderRegisteredField(props: FieldProps<FieldSchema>): ReactElement {
  const component = (fieldRegistry as unknown as Record<string, ComponentType<FieldProps<FieldSchema>> | undefined>)[props.field.type];
  return component ? createElement(component, props) : createElement(UnsupportedField, { field: props.field });
}
