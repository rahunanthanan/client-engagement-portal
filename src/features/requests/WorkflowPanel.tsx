import { Suspense } from 'react';
import { Alert, Box, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { RequestRecord } from '@/api/contracts';
import { api, queryKeys } from '@/api/endpoints';
import { PROCESS_ACTIVITY_LABELS } from '@/features/workflow/definitions/clientRequestProcess';
import { LazyDecisionTable, LazyProcessViewer } from '@/features/workflow/lazy';
import { formatDateTime } from '@/shared/format';

/**
 * Workflow boundary: the backend owns state transitions and decision outcomes. The UI only shows
 * them: the approved BPMN with the current step highlighted, and the DMN rule that matched.
 */
export function WorkflowPanel({ request }: { request: RequestRecord }) {
  const process = useQuery({
    queryKey: queryKeys.definition('process', request.workflow.processKey),
    queryFn: ({ signal }) => api.getDefinition('process', request.workflow.processKey, signal),
    staleTime: 10 * 60_000,
  });
  const decisionDef = useQuery({
    queryKey: queryKeys.definition('decision', 'risk-tier'),
    queryFn: ({ signal }) => api.getDefinition('decision', 'risk-tier', signal),
    enabled: !!request.decision,
    staleTime: 10 * 60_000,
  });
  const current = request.workflow.currentActivityId;

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1">Current step:</Typography>
          <Chip color={current ? 'warning' : 'success'} label={current ? PROCESS_ACTIVITY_LABELS[current] ?? current : 'Finished'} size="small" />
          <Typography variant="caption" color="text.secondary">
            Process {request.workflow.processKey} v{request.workflow.processVersion} · transitions decided by the (simulated) backend
          </Typography>
        </Stack>
        {process.data ? (
          <Suspense fallback={<Skeleton variant="rectangular" height={380} />}>
            <LazyProcessViewer xml={process.data.content} currentActivityId={current} completedActivityIds={request.workflow.completedActivityIds} />
          </Suspense>
        ) : process.error ? (
          <Alert severity="warning">Process diagram unavailable.</Alert>
        ) : (
          <Skeleton variant="rectangular" height={380} />
        )}
      </Grid>
      <Grid size={12}>
        {request.decision ? (
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1">Risk decision:</Typography>
              <Chip
                size="small"
                color={request.decision.outputs.riskTier === 'HIGH' ? 'error' : request.decision.outputs.riskTier === 'MEDIUM' ? 'warning' : 'success'}
                label={`${request.decision.outputs.riskTier} risk`}
                data-testid="risk-tier"
              />
              <Chip size="small" variant="outlined" label={`${request.decision.outputs.reviewLevel.toLowerCase()} review`} />
              <Typography variant="caption" color="text.secondary">
                matched {request.decision.matchedRuleIds.join(', ')} · evaluated {formatDateTime(request.decision.evaluatedAt)}
              </Typography>
            </Stack>
            {decisionDef.data && (
              <Suspense fallback={<Skeleton variant="rectangular" height={240} />}>
                <LazyDecisionTable xml={decisionDef.data.content} matchedRuleIds={request.decision.matchedRuleIds} />
              </Suspense>
            )}
          </Box>
        ) : (
          <Alert severity="info">The risk decision is evaluated by the backend when the request is submitted.</Alert>
        )}
      </Grid>
    </Grid>
  );
}
