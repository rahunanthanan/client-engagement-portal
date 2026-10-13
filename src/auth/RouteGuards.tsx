import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { useAppSelector } from '@/app/store';
import type { Permission } from './permissions';
import { usePermission } from './usePermission';

/** Redirects anonymous users to sign-in, remembering where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAppSelector((s) => s.auth.status);
  const location = useLocation();
  if (status === 'restoring') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '60vh' }}>
        <CircularProgress aria-label="Restoring session" />
      </Box>
    );
  }
  if (status === 'anonymous') {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <>{children}</>;
}

/** Hides routes the role cannot use. The backend still enforces the same rule on every call. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <Navigate to="/forbidden" replace />;
}
