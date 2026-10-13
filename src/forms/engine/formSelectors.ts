import { shallowEqual } from 'react-redux';
import { useAppSelector } from '@/app/store';
import type { FieldSchema, RowFieldSchema, RowValue, SectionSchema } from '../schema/types';
import { isFieldRequired, isFieldVisible, isSectionVisible } from './formModel';

/**
 * Field-level subscriptions. Each hook selects the smallest possible slice of state, so typing in
 * one field only re-renders that field (plus fields whose visibility/required flag actually flips).
 */

const EMPTY_ROWS: RowValue[] = [];

export function useFieldValue(formId: string, fieldId: string): unknown {
  return useAppSelector((s) => s.forms[formId]?.values[fieldId]);
}

export function useRowFieldValue(formId: string, repeatableId: string, rowId: string, fieldId: string): unknown {
  return useAppSelector((s) => (s.forms[formId]?.values[repeatableId] as RowValue[] | undefined)?.find((r) => r.rowId === rowId)?.[fieldId]);
}

export function useRowIds(formId: string, repeatableId: string): string[] {
  return useAppSelector(
    (s) => ((s.forms[formId]?.values[repeatableId] as RowValue[] | undefined) ?? EMPTY_ROWS).map((r) => r.rowId),
    shallowEqual,
  );
}

export function useFieldError(formId: string, path: string): string | undefined {
  return useAppSelector((s) => s.forms[formId]?.errors[path]);
}

/** Visible + required flags as primitives, so the component only re-renders when a flag flips. */
export function useFieldRules(
  formId: string,
  field: FieldSchema | RowFieldSchema,
  section?: SectionSchema,
  repeatableId?: string,
  rowId?: string,
): { visible: boolean; required: boolean } {
  const visible = useAppSelector((s) => {
    const values = s.forms[formId]?.values ?? {};
    const row = repeatableId ? (values[repeatableId] as RowValue[] | undefined)?.find((r) => r.rowId === rowId) : undefined;
    return isFieldVisible(field, values, row, section);
  });
  const required = useAppSelector((s) => {
    const values = s.forms[formId]?.values ?? {};
    const row = repeatableId ? (values[repeatableId] as RowValue[] | undefined)?.find((r) => r.rowId === rowId) : undefined;
    return isFieldRequired(field, { values, row });
  });
  return { visible, required };
}

export function useSectionVisible(formId: string, section: SectionSchema): boolean {
  return useAppSelector((s) => isSectionVisible(section, s.forms[formId]?.values ?? {}));
}

export function useSectionErrors(formId: string, sectionId: string): string[] | undefined {
  return useAppSelector((s) => s.forms[formId]?.sectionErrors[sectionId]);
}

/** Number of field errors inside a section (for the accordion badge). */
export function useSectionErrorCount(formId: string, section: SectionSchema): number {
  return useAppSelector((s) => {
    const errors = s.forms[formId]?.errors ?? {};
    const ids = new Set(section.fields.map((f) => f.id));
    return Object.keys(errors).filter((path) => ids.has(path.split('.')[0]!)).length + (s.forms[formId]?.sectionErrors[section.id]?.length ?? 0);
  });
}
