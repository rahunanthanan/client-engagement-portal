import { createContext, useContext } from 'react';
import type { AppServices } from './bootstrap';

export const AppServicesContext = createContext<AppServices | null>(null);

export function useAppServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) throw new Error('AppServicesContext missing');
  return services;
}
