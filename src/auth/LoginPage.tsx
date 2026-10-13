import { useActionState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Alert, Box, Button, FormControlLabel, Paper, Radio, RadioGroup, Stack, Typography, FormControl, FormLabel } from '@mui/material';
import type { Role } from '@/api/contracts';
import { useAppServices } from '@/app/AppServicesContext';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { allFormsCleared } from '@/forms/engine/formsSlice';
import { safeReturnTo, signedIn } from './authSlice';
import { DEMO_USERS } from './DemoIdentityAdapter';
import { ROLE_LABELS } from './permissions';

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  CLIENT_ADVISOR: 'Creates requests, completes forms, saves drafts and submits cases.',
  OPERATIONS_REVIEWER: 'Reviews assigned cases and completes workflow tasks.',
  ADMINISTRATOR: 'Manages approved form, process and decision definitions.',
};

/**
 * DEMO sign-in. Uses React 19 `useActionState` for the form action (pending + error state
 * without hand-written useState/useTransition plumbing).
 */
export default function LoginPage() {
  const { identity } = useAppServices();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useAppSelector((s) => s.auth.status);
  // After expiry the old session is kept (status "expired"); if someone else signs in, the open workspace is discarded.
  const previousUserId = useAppSelector((s) => (s.auth.status === 'expired' ? (s.auth.session?.user.userId ?? null) : null));
  const returnTo = safeReturnTo(params.get('returnTo'));
  const expired = params.get('reason') === 'expired';

  const [error, signIn, pending] = useActionState(async (_previous: string | null, formData: FormData) => {
    const role = formData.get('role') as Role | null;
    if (!role || !(role in DEMO_USERS)) return 'Choose a role to continue.';
    const session = await identity.signIn({ role, returnTo });
    if (!session) return null; // a real IdP adapter would have navigated away
    if (previousUserId && previousUserId !== session.user.userId) dispatch(allFormsCleared());
    dispatch(signedIn(session));
    navigate(returnTo, { replace: true });
    return null;
  }, null);

  if (status === 'authenticated') return <Navigate to={returnTo} replace />;

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <title>Sign in · Client Engagement Portal</title>
      <Paper sx={{ p: 4, maxWidth: 520, width: '100%' }}>
        <Typography variant="h1" gutterBottom>
          Client Engagement Portal
        </Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>{identity.label}.</strong> This sample does not connect to any identity provider. Pick a fictional role to explore the
          application. All data is fictional.
        </Alert>
        {expired && (
          <Alert severity="info" sx={{ mb: 2 }} role="status">
            Your session expired. Sign in again to continue where you left off. Drafts saved to the server are safe.
          </Alert>
        )}
        <form action={signIn} aria-label="Demo sign in">
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <FormLabel component="legend">Role</FormLabel>
            <RadioGroup name="role" defaultValue="CLIENT_ADVISOR">
              {(Object.keys(DEMO_USERS) as Role[]).map((role) => (
                <FormControlLabel
                  key={role}
                  value={role}
                  control={<Radio />}
                  label={
                    <Stack>
                      <span>
                        {ROLE_LABELS[role]} — {DEMO_USERS[role].displayName.replace(/ \(.*\)$/, '')}
                      </span>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_DESCRIPTIONS[role]}
                      </Typography>
                    </Stack>
                  }
                  sx={{ alignItems: 'flex-start', my: 0.5 }}
                />
              ))}
            </RadioGroup>
          </FormControl>
          {error && (
            <Alert severity="error" role="alert" sx={{ mt: 1 }}>
              {error}
            </Alert>
          )}
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={pending}>
            {pending ? 'Signing in…' : 'Continue (demo)'}
          </Button>
        </form>
      </Paper>
    </Box>
  );
}
