import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import userEvent from '@testing-library/user-event';
import type { Role } from '@/api/contracts';
import { AppProviders } from '@/app/AppProviders';
import { createAppServices, type AppServices } from '@/app/bootstrap';
import { routes } from '@/app/routes';
import { sessionRestored } from '@/auth/authSlice';
import { DemoIdentityAdapter } from '@/auth/DemoIdentityAdapter';

/** Signed-in services for a role (same composition root as the real app). */
export async function createSignedInServices(role: Role | null, options: { autosaveDelayMs?: number } = {}): Promise<AppServices> {
  const identity = new DemoIdentityAdapter(20);
  const services = createAppServices({ identity, autosaveDelayMs: options.autosaveDelayMs ?? 60_000 });
  const session = role ? await identity.signIn({ role, returnTo: '/' }) : null;
  services.store.dispatch(sessionRestored(session));
  return services;
}

/** Renders the full application (real routes, providers, MSW backend) at `route`. */
export async function renderApp(route: string, role: Role | null = 'CLIENT_ADVISOR', options: { autosaveDelayMs?: number } = {}) {
  const services = await createSignedInServices(role, options);
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const user = userEvent.setup();
  const utils = render(
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, services, router, user };
}
