import type { Role } from '@/api/contracts';

/**
 * Boundary between the application and whatever identity provider is in use.
 *
 * The app only depends on this interface. `DemoIdentityAdapter` implements it for local
 * demos; `OidcIdentityAdapter.example.ts` documents how an OAuth2/OIDC (e.g. ADFS)
 * implementation would satisfy the same contract.
 */
export interface SessionUser {
  userId: string;
  displayName: string;
  role: Role;
}

export interface Session {
  user: SessionUser;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export interface IdentityAdapter {
  /** Human-readable label shown in the UI so nobody mistakes a demo for real sign-in. */
  readonly label: string;
  readonly isDemo: boolean;
  /** Restore an existing session (e.g. after reload). */
  restore(): Promise<Session | null>;
  /** Start sign-in. Real adapters redirect to the IdP; the demo adapter signs in immediately. */
  signIn(options: { role?: Role; returnTo: string }): Promise<Session | null>;
  /** Extend the session (silent renew / refresh via the backend). */
  extend(): Promise<Session | null>;
  signOut(): Promise<void>;
  /**
   * Headers for API calls. With a backend-for-frontend (recommended) this returns `{}`
   * because the browser sends an HttpOnly session cookie automatically.
   */
  getAuthHeaders(): Record<string, string>;
}
