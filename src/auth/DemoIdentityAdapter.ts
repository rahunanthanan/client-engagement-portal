import type { Role } from '@/api/contracts';
import { env } from '@/app/env';
import type { IdentityAdapter, Session, SessionUser } from './IdentityAdapter';

/**
 * DEMO ONLY — NOT AUTHENTICATION.
 *
 * Lets a presenter pick a fictional role. There is no identity provider, password or token.
 * The chosen role is sent in an `X-Demo-User` header that only the simulated (MSW)
 * backend understands. Session metadata (user + expiry, no secrets) is kept in
 * sessionStorage so a page reload keeps the demo signed in.
 */

export const DEMO_USERS: Record<Role, SessionUser> = {
  CLIENT_ADVISOR: { userId: 'u-advisor-01', displayName: 'Alex Rivera (Client Advisor)', role: 'CLIENT_ADVISOR' },
  OPERATIONS_REVIEWER: { userId: 'u-reviewer-01', displayName: 'Sam Patel (Operations Reviewer)', role: 'OPERATIONS_REVIEWER' },
  ADMINISTRATOR: { userId: 'u-admin-01', displayName: 'Jordan Lee (Administrator)', role: 'ADMINISTRATOR' },
};

const STORAGE_KEY = 'cep.demo.session.v1';

export class DemoIdentityAdapter implements IdentityAdapter {
  readonly label = 'Demo identity (no real sign-in)';
  readonly isDemo = true;
  private session: Session | null = null;

  constructor(private readonly sessionMinutes = env.demoSessionMinutes) {}

  async restore(): Promise<Session | null> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Session) : null;
      this.session = parsed && parsed.expiresAt > Date.now() && DEMO_USERS[parsed.user.role] ? parsed : null;
    } catch {
      this.session = null;
    }
    return this.session;
  }

  async signIn({ role = 'CLIENT_ADVISOR' }: { role?: Role; returnTo: string }): Promise<Session> {
    this.session = { user: DEMO_USERS[role], expiresAt: Date.now() + this.sessionMinutes * 60_000 };
    this.persist();
    return this.session;
  }

  async extend(): Promise<Session | null> {
    if (!this.session) return null;
    this.session = { ...this.session, expiresAt: Date.now() + this.sessionMinutes * 60_000 };
    this.persist();
    return this.session;
  }

  /** Demo helper: make the session expire in `ms` milliseconds (used by the simulation panel). */
  expireIn(ms: number): Session | null {
    if (!this.session) return null;
    this.session = { ...this.session, expiresAt: Date.now() + ms };
    this.persist();
    return this.session;
  }

  async signOut(): Promise<void> {
    this.session = null;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }

  getAuthHeaders(): Record<string, string> {
    return this.session ? { 'X-Demo-User': this.session.user.userId } : {};
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));
    } catch {
      /* storage unavailable */
    }
  }
}
