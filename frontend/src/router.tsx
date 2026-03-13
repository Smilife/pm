import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter } from 'react-router-dom';
import { ProtectedAppShell, PublicLoginRoute, PermissionGuard } from './auth/AuthRoutes';

const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })));
const RequirementsPage = lazy(() => import('./pages/RequirementsPage').then((module) => ({ default: module.RequirementsPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })));
const ExecutionsPage = lazy(() => import('./pages/ExecutionsPage').then((module) => ({ default: module.ExecutionsPage })));
const BugsPage = lazy(() => import('./pages/BugsPage').then((module) => ({ default: module.BugsPage })));
const DailyTasksPage = lazy(() => import('./pages/DailyTasksPage').then((module) => ({ default: module.DailyTasksPage })));
const ReportsDailyPage = lazy(() => import('./pages/ReportsDailyPage').then((module) => ({ default: module.ReportsDailyPage })));
const ReportsWeeklyPage = lazy(() => import('./pages/ReportsWeeklyPage').then((module) => ({ default: module.ReportsWeeklyPage })));
const GanttPage = lazy(() => import('./pages/GanttPage').then((module) => ({ default: module.GanttPage })));
const PerformancePage = lazy(() => import('./pages/PerformancePage').then((module) => ({ default: module.PerformancePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));

const settingsPermissions = [
  'settings.member.manage.org',
  'settings.role.manage.org',
  'settings.policy.manage.org',
  'settings.dictionary.view.org',
  'settings.workflow.view.org',
];

function RouteLoading() {
  return (
    <div className="auth-screen auth-screen--loading">
      <Spin size="large" />
      <div>正在加载页面...</div>
    </div>
  );
}

function withLazyPage(element: JSX.Element) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicLoginRoute />,
  },
  {
    path: '/',
    element: <ProtectedAppShell />,
    children: [
      { index: true, element: withLazyPage(<WorkspacePage />) },
      { path: 'workspace', element: withLazyPage(<WorkspacePage />) },
      {
        path: 'requirements',
        element: (
          <PermissionGuard permission="requirement.view.related">
            {withLazyPage(<RequirementsPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'projects',
        element: (
          <PermissionGuard permission="project.view.related">
            {withLazyPage(<ProjectsPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'executions',
        element: (
          <PermissionGuard permission="execution.view.related">
            {withLazyPage(<ExecutionsPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'bugs',
        element: (
          <PermissionGuard permission="bug.view.related">
            {withLazyPage(<BugsPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'daily-tasks',
        element: (
          <PermissionGuard permission="daily_task.view.self">
            {withLazyPage(<DailyTasksPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'reports/daily',
        element: (
          <PermissionGuard permission="report.daily.generate.self">
            {withLazyPage(<ReportsDailyPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'reports/weekly',
        element: (
          <PermissionGuard permission="report.weekly.generate.self">
            {withLazyPage(<ReportsWeeklyPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'gantt',
        element: (
          <PermissionGuard permission="schedule.view.related">
            {withLazyPage(<GanttPage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'performance',
        element: (
          <PermissionGuard permission="execution.view.related">
            {withLazyPage(<PerformancePage />)}
          </PermissionGuard>
        ),
      },
      {
        path: 'settings',
        element: (
          <PermissionGuard permissions={settingsPermissions}>
            {withLazyPage(<SettingsPage />)}
          </PermissionGuard>
        ),
      },
    ],
  },
  {
    path: '*',
    element: withLazyPage(<NotFoundPage />),
  },
]);