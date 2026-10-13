import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { RequireAuth, RequirePermission } from '@/auth/RouteGuards';
import { AppShell } from './AppShell';
import { ForbiddenPage, NotFoundPage } from './StatusPages';

// Route-level code splitting: every screen is its own chunk.
const LoginPage = lazy(() => import('@/auth/LoginPage'));
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const CreateRequest = lazy(() => import('@/features/requests/CreateRequest'));
const RequestViewerPage = lazy(() => import('@/features/requests/RequestViewerPage'));
const WorkspacePage = lazy(() => import('@/features/workspace/WorkspacePage'));
const TaskInbox = lazy(() => import('@/features/tasks/TaskInbox'));
const TaskDetail = lazy(() => import('@/features/tasks/TaskDetail'));
const DefinitionsAdmin = lazy(() => import('@/features/admin/DefinitionsAdmin'));
const DefinitionEditor = lazy(() => import('@/features/admin/DefinitionEditor'));

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'requests/new', element: <RequirePermission permission="request:create"><CreateRequest /></RequirePermission> },
      { path: 'requests/:requestId', element: <RequirePermission permission="request:view"><RequestViewerPage /></RequirePermission> },
      { path: 'workspace', element: <RequirePermission permission="request:edit"><WorkspacePage /></RequirePermission> },
      { path: 'workspace/:requestId', element: <RequirePermission permission="request:edit"><WorkspacePage /></RequirePermission> },
      { path: 'tasks', element: <RequirePermission permission="task:view"><TaskInbox /></RequirePermission> },
      { path: 'tasks/:taskId', element: <RequirePermission permission="task:view"><TaskDetail /></RequirePermission> },
      { path: 'admin', element: <RequirePermission permission="definition:view"><DefinitionsAdmin /></RequirePermission> },
      { path: 'admin/:kind/:definitionId', element: <RequirePermission permission="definition:view"><DefinitionEditor /></RequirePermission> },
      { path: 'forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
