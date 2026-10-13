import type { Role } from '@/api/contracts';

/**
 * UI permissions. These only decide what the interface OFFERS; the backend re-checks every
 * call (the MSW handlers do the same) because client-side checks can always be bypassed.
 */
export type Permission =
  | 'client:search'
  | 'request:create'
  | 'request:edit'
  | 'request:submit'
  | 'request:view'
  | 'task:view'
  | 'task:act'
  | 'definition:view'
  | 'definition:edit'
  | 'definition:approve';

export const ROLE_PERMISSIONS: Record<Role, ReadonlyArray<Permission>> = {
  CLIENT_ADVISOR: ['client:search', 'request:create', 'request:edit', 'request:submit', 'request:view'],
  OPERATIONS_REVIEWER: ['client:search', 'request:view', 'task:view', 'task:act'],
  ADMINISTRATOR: ['request:view', 'definition:view', 'definition:edit', 'definition:approve'],
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}

export const ROLE_LABELS: Record<Role, string> = {
  CLIENT_ADVISOR: 'Client Advisor',
  OPERATIONS_REVIEWER: 'Operations Reviewer',
  ADMINISTRATOR: 'Administrator',
};
