import { Chip, Tooltip } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import EditNoteIcon from '@mui/icons-material/EditNote';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useAppSelector } from '@/app/store';
import { formatTime } from '@/shared/format';

/** Live save state for one tab. `aria-live` announces changes without moving focus. */
export function SaveStatusIndicator({ requestId }: { requestId: string }) {
  const tab = useAppSelector((s) => s.workspace.tabs[requestId]);
  if (!tab || tab.mode !== 'edit') return null;

  const config = {
    idle: { label: 'No changes', icon: <CloudDoneIcon />, color: 'default' as const },
    unsaved: { label: 'Unsaved changes', icon: <EditNoteIcon />, color: 'warning' as const },
    saving: { label: 'Saving…', icon: <CloudSyncIcon />, color: 'info' as const },
    saved: { label: `Saved ${formatTime(tab.lastSavedAt)}`, icon: <CloudDoneIcon />, color: 'success' as const },
    error: { label: 'Save failed', icon: <CloudOffIcon />, color: 'error' as const },
    conflict: { label: 'Conflict', icon: <WarningAmberIcon />, color: 'error' as const },
  }[tab.status];

  return (
    <Tooltip title={`Revision ${tab.serverRevision} · edit ${tab.editSeq} · saved up to edit ${tab.savedSeq}`}>
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        variant="outlined"
        size="small"
        role="status"
        aria-live="polite"
        data-testid="save-status"
        data-status={tab.status}
      />
    </Tooltip>
  );
}
