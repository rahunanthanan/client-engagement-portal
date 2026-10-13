import { Link as RouterLink } from 'react-router';
import { Alert, Button } from '@mui/material';
import { PageHeader } from '@/shared/components/PageHeader';

export function ForbiddenPage() {
  return (
    <>
      <PageHeader title="Not available for your role" />
      <Alert severity="warning" role="alert" action={<Button component={RouterLink} to="/">Dashboard</Button>}>
        Your role does not include access to this page. If you need it, ask an administrator (fictional process).
      </Alert>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Alert severity="info" action={<Button component={RouterLink} to="/">Dashboard</Button>}>
        This page does not exist.
      </Alert>
    </>
  );
}
