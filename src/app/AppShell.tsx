import { lazy, Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Alert, AppBar, Badge, Box, Button, CircularProgress, Container, Snackbar, Stack, Toolbar, Typography } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import { useAppServices } from './AppServicesContext';
import { useAppDispatch, useAppSelector } from './store';
import { noticeDismissed, simulationPanelToggled } from './uiSlice';
import { env } from '@/app/env';
import { ROLE_LABELS } from '@/auth/permissions';
import { SessionManager } from '@/auth/SessionManager';
import { useCurrentUser, usePermission } from '@/auth/usePermission';
import { useSignOut } from '@/auth/useSignOut';
import { selectUnsavedTabs } from '@/features/workspace/selectors';
import { UnsavedChangesGuard } from '@/features/workspace/UnsavedChangesGuard';

// Demo-only panel (imports the mock backend), so it is a separate chunk that real builds never load.
const SimulationPanel = lazy(() => import('./SimulationPanel'));

/** Shared application shell: navigation by permission, demo labels, session handling, notices. */
export function AppShell() {
  const { identity } = useAppServices();
  const user = useCurrentUser();
  const dispatch = useAppDispatch();
  const signOut = useSignOut();
  const openTabs = useAppSelector((s) => s.workspace.order.length);
  const unsaved = useAppSelector(selectUnsavedTabs).length;
  const notice = useAppSelector((s) => s.ui.notices[0]);
  const canCreate = usePermission('request:create');
  const canReview = usePermission('task:view');
  const isAdmin = usePermission('definition:view');

  const navButton = (to: string, label: string, badge?: number) => (
    <Button component={NavLink} to={to} color="inherit" end={to === '/'} sx={{ '&.active': { textDecoration: 'underline', textUnderlineOffset: 6 } }}>
      {badge ? (
        <Badge badgeContent={badge} color="warning">
          {label}
        </Badge>
      ) : (
        label
      )}
    </Button>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <a href="#main" className="visually-hidden">
        Skip to main content
      </a>
      <Box component="div" role="note" sx={{ bgcolor: 'warning.light', px: 2, py: 0.5, fontSize: 12, textAlign: 'center' }}>
        Sample application · {env.apiMode === 'mock' ? 'SIMULATED backend (Mock Service Worker)' : 'HTTP backend'} · {identity.isDemo ? 'DEMO identity, no real sign-in' : identity.label} ·
        fictional data only
      </Box>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" component="span" sx={{ mr: 2, fontWeight: 600 }}>
            Client Engagement Portal
          </Typography>
          <Box component="nav" aria-label="Main" sx={{ display: 'flex', gap: 0.5, flexGrow: 1, flexWrap: 'wrap' }}>
            {navButton('/', 'Dashboard')}
            {canCreate && navButton('/requests/new', 'New request')}
            {canCreate && navButton('/workspace', 'Workspace', openTabs)}
            {canReview && navButton('/tasks', 'Tasks')}
            {isAdmin && navButton('/admin', 'Definitions')}
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {env.apiMode === 'mock' && (
              <Button color="inherit" startIcon={<ScienceIcon />} onClick={() => dispatch(simulationPanelToggled())}>
                Simulation
              </Button>
            )}
            {user && (
              <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }}>
                {user.displayName.replace(/ \(.*\)$/, '')} · {ROLE_LABELS[user.role]}
              </Typography>
            )}
            <Button
              color="inherit"
              variant="outlined"
              size="small"
              onClick={() => {
                if (unsaved === 0 || window.confirm(`${unsaved} open request(s) have unsaved changes that will be lost. Sign out anyway?`)) void signOut();
              }}
            >
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" component="main" id="main" sx={{ py: 3 }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
              <CircularProgress aria-label="Loading page" />
            </Box>
          }
        >
          <Outlet />
        </Suspense>
      </Container>
      <SessionManager />
      <UnsavedChangesGuard />
      {env.apiMode === 'mock' && (
        <Suspense fallback={null}>
          <SimulationPanel />
        </Suspense>
      )}
      <Snackbar open={!!notice} autoHideDuration={6000} onClose={() => notice && dispatch(noticeDismissed(notice.id))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {notice ? (
          <Alert severity={notice.severity} onClose={() => dispatch(noticeDismissed(notice.id))} variant="filled">
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
