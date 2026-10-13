import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useAppServices } from '@/app/AppServicesContext';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { safeReturnTo, sessionExpired, sessionExtended } from './authSlice';

const WARNING_MS = 2 * 60_000;

/**
 * Session lifecycle in the UI:
 * - warns two minutes before expiry and offers to extend,
 * - on expiry (client clock or a 401 from any API call) shows a blocking dialog,
 * - re-authentication returns the user to the same page; open tabs stay in the workspace and
 *   drafts are already on the server.
 */
export function SessionManager() {
  const { identity } = useAppServices();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, session, returnTo } = useAppSelector((s) => s.auth);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const remaining = session ? session.expiresAt - now : Infinity;

  useEffect(() => {
    if (status === 'authenticated' && remaining <= 0) {
      dispatch(sessionExpired({ returnTo: `${location.pathname}${location.search}` }));
    }
  }, [status, remaining, dispatch, location.pathname, location.search]);

  const extend = async () => {
    const next = await identity.extend();
    if (next) {
      dispatch(sessionExtended(next));
      setNow(Date.now());
    }
  };

  const reauthenticate = async () => {
    const target = safeReturnTo(returnTo ?? `${location.pathname}${location.search}`);
    await identity.signOut();
    // Auth state stays "expired" (not anonymous) so the login page knows whose workspace is open.
    await navigate(`/login?reason=expired&returnTo=${encodeURIComponent(target)}`, { replace: true });
  };

  if (status === 'expired') {
    return (
      <Dialog open aria-labelledby="session-expired-title" aria-describedby="session-expired-text">
        <DialogTitle id="session-expired-title">Your session has expired</DialogTitle>
        <DialogContent>
          <DialogContentText id="session-expired-text">
            For security, you need to sign in again. Your open tabs stay in the workspace and drafts already saved to the server are safe.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={reauthenticate} autoFocus>
            Sign in again
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  if (status === 'authenticated' && remaining > 0 && remaining <= WARNING_MS) {
    return (
      <Dialog open aria-labelledby="session-warning-title">
        <DialogTitle id="session-warning-title">Your session is about to expire</DialogTitle>
        <DialogContent>
          <DialogContentText role="timer" aria-live="polite">
            You will be signed out in {Math.ceil(remaining / 1000)} seconds.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={extend} autoFocus>
            Stay signed in
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  return null;
}
