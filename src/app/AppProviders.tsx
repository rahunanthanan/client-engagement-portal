import type { ReactNode } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { theme } from '@/styles/theme';
import { tokensAsCssVariables } from '@/styles/tokens';
import type { AppServices } from './bootstrap';
import { AppServicesContext } from './AppServicesContext';

const cssVariables = { ':root': tokensAsCssVariables() };

export function AppProviders({ services, children }: { services: AppServices; children: ReactNode }) {
  return (
    <AppServicesContext.Provider value={services}>
      <Provider store={services.store}>
        <QueryClientProvider client={services.queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <GlobalStyles styles={cssVariables} />
            {children}
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </AppServicesContext.Provider>
  );
}
