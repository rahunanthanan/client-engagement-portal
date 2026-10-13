/**
 * ILLUSTRATIVE ONLY — NOT WIRED INTO THE APP AND NOT CONNECTED TO ANY IDENTITY PROVIDER.
 * REQUIRES: an OIDC-capable IdP (e.g. ADFS 2019+ / Entra ID), a registered client, and a
 * backend-for-frontend (BFF) owned by the platform team. None of these are part of this repo.
 *
 * Recommended pattern for an internal staff portal: Authorization Code + PKCE handled by a BFF.
 *
 *   Browser ──GET /auth/login?returnTo=/workspace/REQ-1──▶ BFF ──302──▶ ADFS /authorize
 *   ADFS ──302 code──▶ BFF /auth/callback ──(code + verifier, client auth)──▶ ADFS /token
 *   BFF stores tokens server-side, sets  Set-Cookie: __Host-session=...; HttpOnly; Secure; SameSite=Lax
 *   BFF ──302──▶ /workspace/REQ-1 (returnTo validated as a same-origin relative path)
 *
 * Consequences for the frontend:
 * - The SPA never sees access/refresh tokens, so there is nothing to put in localStorage.
 * - API calls are same-origin (`credentials: 'same-origin'`), the cookie is attached automatically.
 * - CSRF: SameSite cookies plus an anti-CSRF header for state-changing calls.
 * - Session expiry: the BFF returns 401; the app shows the expiry dialog and redirects to
 *   `/auth/login?returnTo=<current path>`. Drafts are already on the server, so nothing is lost.
 * - Logout: POST /auth/logout clears the BFF session, then redirects to the IdP end-session endpoint.
 * - Authorization: roles/groups come from token claims and are enforced by the backend on every
 *   call; `GET /auth/me` returns the user and role so the UI can hide unavailable actions.
 */
import type { Role } from '@/api/contracts';
import type { IdentityAdapter, Session } from './IdentityAdapter';

interface MeResponse {
  userId: string;
  displayName: string;
  role: Role;
  expiresAt: number;
}

export class OidcBffIdentityAdapter implements IdentityAdapter {
  readonly label = 'Corporate sign-in';
  readonly isDemo = false;

  constructor(private readonly bffBasePath = '/auth') {}

  async restore(): Promise<Session | null> {
    const response = await fetch(`${this.bffBasePath}/me`, { credentials: 'same-origin' });
    if (response.status === 401) return null;
    const me = (await response.json()) as MeResponse;
    return { user: { userId: me.userId, displayName: me.displayName, role: me.role }, expiresAt: me.expiresAt };
  }

  async signIn({ returnTo }: { returnTo: string }): Promise<null> {
    window.location.assign(`${this.bffBasePath}/login?returnTo=${encodeURIComponent(returnTo)}`);
    return null; // the page navigates away
  }

  async extend(): Promise<Session | null> {
    const response = await fetch(`${this.bffBasePath}/refresh`, { method: 'POST', credentials: 'same-origin' });
    return response.ok ? this.restore() : null;
  }

  async signOut(): Promise<void> {
    await fetch(`${this.bffBasePath}/logout`, { method: 'POST', credentials: 'same-origin' });
    window.location.assign('/');
  }

  getAuthHeaders(): Record<string, string> {
    return {}; // cookie-based; no bearer token in the browser
  }
}
