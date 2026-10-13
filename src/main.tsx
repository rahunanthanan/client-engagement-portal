import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createAppServices } from './app/bootstrap';
import { env } from '@/app/env';
import { DemoIdentityAdapter } from './auth/DemoIdentityAdapter';
import './styles/global.scss';

async function start() {
  if (env.apiMode === 'mock') {
    // SIMULATED BACKEND: Mock Service Worker intercepts /api/* in the browser.
    const [{ worker }, scenarios] = await Promise.all([import('./mocks/browser'), import('./mocks/scenarios')]);
    await worker.start({ onUnhandledRequest: 'bypass', serviceWorker: { url: `${env.baseUrl}mockServiceWorker.js` }, quiet: true });
    // Expose scenario switches for Playwright and live demos.
    (window as unknown as { __cep: unknown }).__cep = { setScenarios: scenarios.setScenarios, getScenarios: scenarios.getScenarios };
  }

  const services = createAppServices({ identity: new DemoIdentityAdapter(), persistWorkspace: env.demoLocalPersistence });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  );
}

void start();
