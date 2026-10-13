import { useAppSelector } from '@/app/store';
import { hasPermission, type Permission } from './permissions';

export function usePermission(permission: Permission): boolean {
  return useAppSelector((s) => hasPermission(s.auth.session?.user.role, permission));
}

export function useCurrentUser() {
  return useAppSelector((s) => s.auth.session?.user ?? null);
}
