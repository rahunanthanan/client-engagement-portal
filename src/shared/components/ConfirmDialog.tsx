import type { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export interface ConfirmAction {
  label: string;
  onClick: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'error' | 'inherit';
  autoFocus?: boolean;
}

export function ConfirmDialog({ open, title, children, actions, onClose }: { open: boolean; title: string; children: ReactNode; actions: ConfirmAction[]; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby="confirm-title" aria-describedby="confirm-text">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="confirm-text" component="div">
          {children}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        {actions.map((a) => (
          <Button key={a.label} onClick={a.onClick} variant={a.variant ?? 'text'} color={a.color ?? 'primary'} autoFocus={a.autoFocus}>
            {a.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
}
