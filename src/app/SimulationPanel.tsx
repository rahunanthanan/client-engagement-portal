import { useSyncExternalStore } from 'react';
import { Alert, Box, Button, Divider, Drawer, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { DemoIdentityAdapter } from '@/auth/DemoIdentityAdapter';
import { sessionExtended } from '@/auth/authSlice';
import { allFormsCleared } from '@/forms/engine/formsSlice';
import { clearPersistedWorkspace } from '@/features/workspace/workspacePersistence';
import { resetDb } from '@/mocks/db';
import { getScenarios, setScenarios, subscribeScenarios, type Scenarios } from '@/mocks/scenarios';
import { useAppServices } from './AppServicesContext';
import { useAppDispatch, useAppSelector } from './store';
import { renderCountsToggled, simulationPanelToggled } from './uiSlice';

/**
 * DEMO ONLY: switches for the simulated backend so failure paths can be shown live.
 * Not included in a real build (the backend would not be mocked).
 */
export default function SimulationPanel() {
  const open = useAppSelector((s) => s.ui.simulationPanelOpen);
  const showRenderCounts = useAppSelector((s) => s.ui.showRenderCounts);
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { identity } = useAppServices();
  const scenarios = useSyncExternalStore(subscribeScenarios, getScenarios);

  const toggle = (key: keyof Scenarios) => (_e: unknown, checked: boolean) => setScenarios({ [key]: checked } as Partial<Scenarios>);

  return (
    <Drawer anchor="right" open={open} onClose={() => dispatch(simulationPanelToggled(false))}>
      <Box sx={{ width: 340, p: 2 }} role="region" aria-label="Simulation controls">
        <Typography variant="h2">Simulation controls</Typography>
        <Alert severity="warning" sx={{ my: 1 }}>
          Demo only. These switches change the simulated backend (Mock Service Worker).
        </Alert>
        <Stack spacing={1}>
          <TextField
            select
            size="small"
            label="Draft save failures"
            value={scenarios.saveFailure}
            onChange={(e) => setScenarios({ saveFailure: e.target.value as Scenarios['saveFailure'] })}
          >
            <MenuItem value="none">None</MenuItem>
            <MenuItem value="transient">Transient (one 503, retried safely)</MenuItem>
            <MenuItem value="persistent">Persistent (every save fails)</MenuItem>
          </TextField>
          <FormControlLabel
            control={<Switch checked={scenarios.delayNextSaveResponseMs > 0} onChange={(_e, c) => setScenarios({ delayNextSaveResponseMs: c ? 2500 : 0 })} />}
            label="Delay next save response (out-of-order)"
          />
          <FormControlLabel control={<Switch checked={scenarios.conflictOnNextSave} onChange={toggle('conflictOnNextSave')} />} label="Colleague edits before next save (409)" />
          <FormControlLabel control={<Switch checked={scenarios.rejectNextSubmission} onChange={toggle('rejectNextSubmission')} />} label="Server rejects next submission (422)" />
          <FormControlLabel control={<Switch checked={scenarios.denyNextTaskAction} onChange={toggle('denyNextTaskAction')} />} label="Deny next task action (403)" />
          <FormControlLabel control={<Switch checked={scenarios.expireSessionOnNextCall} onChange={toggle('expireSessionOnNextCall')} />} label="Server expires session on next call (401)" />
          <FormControlLabel control={<Switch checked={scenarios.searchJitter} onChange={toggle('searchJitter')} />} label="Random search latency (stale responses)" />
          <TextField
            size="small"
            type="number"
            label="Extra latency (ms)"
            value={scenarios.latencyMs}
            onChange={(e) => setScenarios({ latencyMs: Math.max(0, Number(e.target.value)) })}
          />
          <Divider />
          <Button
            variant="outlined"
            disabled={!(identity instanceof DemoIdentityAdapter)}
            onClick={() => {
              if (identity instanceof DemoIdentityAdapter) {
                const session = identity.expireIn(125_000);
                if (session) dispatch(sessionExtended(session));
              }
            }}
          >
            Expire client session in ~2 minutes
          </Button>
          <FormControlLabel control={<Switch checked={showRenderCounts} onChange={() => dispatch(renderCountsToggled())} />} label="Show field render counts" />
          <Button
            color="error"
            onClick={() => {
              resetDb();
              clearPersistedWorkspace();
              dispatch(allFormsCleared());
              queryClient.clear();
            }}
          >
            Reset demo data
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
