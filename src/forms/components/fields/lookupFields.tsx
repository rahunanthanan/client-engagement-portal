import { useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { shallowEqual } from 'react-redux';
import { api, queryKeys } from '@/api/endpoints';
import { useAppSelector } from '@/app/store';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import type { DropdownFieldSchema, RowValue, SearchFieldSchema, SearchValue } from '../../schema/types';
import { isRowRef } from '../../engine/rules';
import { useFormEngine } from '../FormEngineContext';
import type { FieldProps } from './types';

/** Subscribes only to the parent values this dropdown depends on. */
function useParentKey(field: DropdownFieldSchema, path: FieldProps['path']): string | null | undefined {
  const { api: formApi } = useFormEngine();
  const parents = useAppSelector((s) => {
    if (field.options.source !== 'api' || !field.options.dependsOn?.length) return undefined;
    const values = s.forms[formApi.formId]?.values ?? {};
    const row =
      typeof path === 'string' ? undefined : (values[path.repeatableId] as RowValue[] | undefined)?.find((r) => r.rowId === path.rowId);
    return field.options.dependsOn.map((ref) => (isRowRef(ref) ? row?.[ref.slice(4)] : values[ref]));
  }, shallowEqual);
  if (parents === undefined) return undefined;
  if (parents.some((p) => p === undefined || p === null || p === '')) return null;
  return parents.map(String).join(',');
}

export function DropdownInput({ field, path, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<DropdownFieldSchema>) {
  const parentKey = useParentKey(field, path);
  const source = field.options;
  const lookup = useQuery({
    queryKey: queryKeys.lookup(source.source === 'api' ? source.lookup : '', parentKey ?? undefined),
    queryFn: ({ signal }) => api.getLookup(source.source === 'api' ? source.lookup : '', parentKey ?? undefined, signal),
    enabled: source.source === 'api' && parentKey !== null,
    staleTime: 5 * 60_000,
  });

  const options = source.source === 'static' ? source.items : (lookup.data ?? []);
  const waitingForParent = source.source === 'api' && parentKey === null;
  const help = waitingForParent ? 'Choose the field above first.' : lookup.isError ? 'Options could not be loaded.' : field.helpText;

  return (
    <TextField
      id={domId}
      select
      label={field.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      onBlur={onBlur}
      required={required}
      error={!!error || lookup.isError}
      helperText={error ?? help}
      disabled={readOnly || waitingForParent}
      fullWidth
      size="small"
      slotProps={{
        select: { native: true },
        inputLabel: { shrink: true },
        input: {
          endAdornment: lookup.isFetching ? <CircularProgress size={16} sx={{ mr: 3 }} aria-label="Loading options" /> : undefined,
        },
      }}
    >
      <option value="">{waitingForParent ? '—' : 'Select…'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </TextField>
  );
}

/**
 * Smart search: input is debounced, each query string is its own cache entry (so a slow,
 * older response can never replace results for the current text), and the previous results stay
 * visible while the next page loads.
 */
export function SearchInput({ field, domId, value, error, required, readOnly, onChange, onBlur }: FieldProps<SearchFieldSchema>) {
  const [input, setInput] = useState('');
  const debounced = useDebouncedValue(input.trim(), 300);
  const minChars = field.minChars ?? 2;
  const results = useQuery({
    queryKey: queryKeys.lookupSearch(field.lookup, debounced),
    queryFn: ({ signal }) => api.searchLookup(field.lookup, debounced, signal),
    enabled: debounced.length >= minChars,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const selected = (value as SearchValue | undefined) ?? null;

  return (
    <Autocomplete
      id={domId}
      options={debounced.length >= minChars ? (results.data ?? []) : []}
      value={selected}
      onChange={(_e, option) => onChange(option ? { id: option.id, label: option.label } : undefined)}
      inputValue={input}
      onInputChange={(_e, text) => setInput(text)}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(o) => o.label}
      filterOptions={(x) => x}
      loading={results.isFetching}
      readOnly={readOnly}
      noOptionsText={debounced.length < minChars ? `Type at least ${minChars} characters` : 'No matches'}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField {...params} label={field.label} required={required} error={!!error} helperText={error ?? field.helpText} size="small" />
      )}
    />
  );
}
