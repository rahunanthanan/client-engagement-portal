import { Chip } from '@mui/material';
import type { RequestStatus } from '@/api/contracts';

const CONFIG: Record<RequestStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  IN_REVIEW: { label: 'In review', color: 'info' },
  RETURNED: { label: 'Returned', color: 'warning' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
};

export function StatusChip({ status }: { status: RequestStatus }) {
  const { label, color } = CONFIG[status];
  return <Chip size="small" label={label} color={color} variant={color === 'default' ? 'outlined' : 'filled'} />;
}
