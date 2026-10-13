import { useEffect, useMemo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { sessionRestored } from '@/auth/authSlice';
import { AppProviders } from '@/app/AppProviders';
import type { AppServices } from '@/app/bootstrap';
import { routes } from '@/app/routes';

export function App({ services }: { services: AppServices }) {
  const router = useMemo(() => createBrowserRouter(routes), []);

  useEffect(() => {
    void services.identity.restore().then((session) => services.store.dispatch(sessionRestored(session)));
  }, [services]);

  return (
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
