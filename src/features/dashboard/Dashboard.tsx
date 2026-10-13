import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, Grid, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '@/api/endpoints';
import { ROLE_LABELS } from '@/auth/permissions';
import { useCurrentUser, usePermission } from '@/auth/usePermission';
import { PageHeader } from '@/shared/components/PageHeader';
import { RequestSummaryIsland } from '@/widgets/request-summary/PreactIsland';
import { ClientSearch } from './ClientSearch';
import { RequestList } from './RequestList';

export default function Dashboard() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const canSearch = usePermission('client:search');
  const canCreate = usePermission('request:create');
  const canReview = usePermission('task:view');
  const isAdmin = usePermission('definition:view');

  const summaryParams = { page: 1, pageSize: 50, mine: true };
  const summary = useQuery({ queryKey: queryKeys.requests(summaryParams), queryFn: ({ signal }) => api.listRequests(summaryParams, signal) });
  const tasks = useQuery({ queryKey: queryKeys.tasks(), queryFn: ({ signal }) => api.listTasks(signal), enabled: canReview });

  const counts = useMemo(() => {
    const items = summary.data?.items ?? [];
    const count = (...statuses: string[]) => items.filter((i) => statuses.includes(i.status)).length;
    return [
      { label: 'Drafts', value: count('DRAFT'), tone: 'neutral' as const },
      { label: 'Returned', value: count('RETURNED'), tone: 'warning' as const },
      { label: 'In review', value: count('IN_REVIEW'), tone: 'info' as const },
      { label: 'Approved', value: count('APPROVED'), tone: 'success' as const },
    ];
  }, [summary.data]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={user ? `Signed in as ${user.displayName.replace(/ \(.*\)$/, '')} · ${ROLE_LABELS[user.role]}` : undefined}
        actions={canCreate ? <Button variant="contained" onClick={() => navigate('/requests/new')}>New request</Button> : undefined}
      />
      <Grid container spacing={2}>
        <Grid size={12}>
          <RequestSummaryIsland title="Request summary" counts={counts} />
          <Typography variant="caption" color="text.secondary">
            Summary tiles are a Preact widget embedded in the React app.
          </Typography>
        </Grid>
        {canReview && (
          <Grid size={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h2" gutterBottom>
                My review tasks
              </Typography>
              <Typography>{tasks.data ? `${tasks.data.length} open task(s) assigned to you.` : 'Loading…'}</Typography>
              <Button sx={{ mt: 1 }} variant="contained" onClick={() => navigate('/tasks')}>
                Open task inbox
              </Button>
            </Paper>
          </Grid>
        )}
        {isAdmin && (
          <Grid size={12}>
            <Alert severity="info" action={<Button onClick={() => navigate('/admin')}>Manage definitions</Button>}>
              Administrators manage approved form, process and decision definitions.
            </Alert>
          </Grid>
        )}
        {canSearch && (
          <Grid size={{ xs: 12, lg: 6 }}>
            <ClientSearch />
          </Grid>
        )}
        {canCreate && (
          <Grid size={{ xs: 12, lg: 6 }}>
            <RequestList title="My drafts and returned requests" status="OPEN_DRAFTS" />
          </Grid>
        )}
        <Grid size={12}>
          <RequestList title={canCreate ? 'All my requests' : 'Recent requests'} />
        </Grid>
      </Grid>
    </>
  );
}
