import { Alert, AlertTitle, Button } from '@mui/material';
import { describeError, isApiError } from '@/api/httpClient';

/** Accessible error block: announced to screen readers, safe message, correlation reference, retry. */
export function ErrorState({ error, title = 'Something went wrong', onRetry }: { error: unknown; title?: string; onRetry?: () => void }) {
  const reference = isApiError(error) ? error.correlationId.slice(0, 8) : undefined;
  return (
    <Alert
      severity="error"
      role="alert"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {describeError(error)}
      {reference && isApiError(error) && error.status !== 0 && error.status < 500 ? ` (reference ${reference})` : ''}
    </Alert>
  );
}
