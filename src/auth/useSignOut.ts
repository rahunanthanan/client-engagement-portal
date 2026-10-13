import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAppServices } from '@/app/AppServicesContext';
import { useAppDispatch } from '@/app/store';
import { allFormsCleared } from '@/forms/engine/formsSlice';
import { clearPersistedWorkspace } from '@/features/workspace/workspacePersistence';
import { signedOut } from './authSlice';

/** Logout clears every client-side copy of request data: Redux workspace, query cache and demo storage. */
export function useSignOut() {
  const { identity, queryClient } = useAppServices();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return useCallback(async () => {
    await identity.signOut();
    dispatch(allFormsCleared());
    dispatch(signedOut());
    queryClient.clear();
    clearPersistedWorkspace();
    navigate('/login', { replace: true });
  }, [identity, dispatch, queryClient, navigate]);
}
