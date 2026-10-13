import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Session } from './IdentityAdapter';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated' | 'expired';

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** Where to return after re-authentication (always a same-origin relative path). */
  returnTo: string | null;
}

const initialState: AuthState = { status: 'restoring', session: null, returnTo: null };

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionRestored(state, action: PayloadAction<Session | null>) {
      state.session = action.payload;
      state.status = action.payload ? 'authenticated' : 'anonymous';
    },
    signedIn(state, action: PayloadAction<Session>) {
      state.session = action.payload;
      state.status = 'authenticated';
      state.returnTo = null;
    },
    sessionExtended(state, action: PayloadAction<Session>) {
      state.session = action.payload;
    },
    sessionExpired(state, action: PayloadAction<{ returnTo: string }>) {
      if (state.status !== 'authenticated') return;
      state.status = 'expired';
      state.returnTo = action.payload.returnTo;
    },
    signedOut() {
      return { status: 'anonymous' as const, session: null, returnTo: null };
    },
  },
});

export const { sessionRestored, signedIn, sessionExtended, sessionExpired, signedOut } = authSlice.actions;

/** Prevents open redirects: only same-origin, absolute-path, non-protocol-relative values are allowed. */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const url = new URL(value, 'https://portal.invalid');
    return url.origin === 'https://portal.invalid' ? `${url.pathname}${url.search}` : '/';
  } catch {
    return '/';
  }
}
