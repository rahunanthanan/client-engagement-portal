import { useId, useState } from 'react';
import { Alert, Box, Button, Chip, FormHelperText, Stack, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { describeError } from '@/api/httpClient';
import { checkAttachment, formatBytes, sanitizeFileName } from '@/shared/attachments';
import type { AttachmentFieldSchema, AttachmentValue } from '../../schema/types';
import { useFormEngine } from '../FormEngineContext';
import type { FieldProps } from './types';

export function AttachmentInput({ field, domId, value, error, required, readOnly, onChange }: FieldProps<AttachmentFieldSchema>) {
  const { context } = useFormEngine();
  const files = (value as AttachmentValue[] | undefined) ?? [];
  const [localError, setLocalError] = useState<string>();
  const hintId = useId();

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAttachment(context.requestId ?? '', field.documentType, file),
    onSuccess: (record) => onChange([...files, record]),
    onError: (e) => setLocalError(describeError(e)),
  });

  const onSelect = (list: FileList | null) => {
    setLocalError(undefined);
    const file = list?.[0];
    if (!file) return;
    if (files.length >= field.maxFiles) {
      setLocalError(`Attach no more than ${field.maxFiles} files.`);
      return;
    }
    const problem = checkAttachment(file, field);
    if (problem) {
      setLocalError(problem);
      return;
    }
    upload.mutate(file);
  };

  const message = localError ?? error;
  return (
    <Box>
      <Typography variant="subtitle2" component="label" htmlFor={domId}>
        {field.label}
        {required ? ' *' : ''}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" id={hintId}>
        {field.helpText ? `${field.helpText} ` : ''}PDF, PNG or JPEG, up to {field.maxSizeMb} MB, max {field.maxFiles} files.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ my: 1, flexWrap: 'wrap' }}>
        {files.map((f) => (
          <Chip
            key={f.attachmentId}
            label={`${sanitizeFileName(f.fileName)} · ${formatBytes(f.sizeBytes)}${f.scanStatus === 'PENDING' ? ' · scanning' : ''}`}
            onDelete={readOnly ? undefined : () => onChange(files.filter((x) => x.attachmentId !== f.attachmentId))}
          />
        ))}
      </Stack>
      {!readOnly && (
        <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} disabled={upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Add file'}
          <input
            id={domId}
            hidden
            type="file"
            accept={field.accept.join(',')}
            aria-describedby={hintId}
            onChange={(e) => {
              onSelect(e.target.files);
              e.target.value = '';
            }}
          />
        </Button>
      )}
      {message && (
        <Alert severity="error" sx={{ mt: 1 }} role="alert">
          {message}
        </Alert>
      )}
      {!message && files.length === 0 && required && <FormHelperText>At least one document is required to submit.</FormHelperText>}
    </Box>
  );
}
