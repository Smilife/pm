import { createBrowserRouter } from 'react-router-dom';
import { ProtectedAppShell, PublicLoginRoute, PermissionGuard } from './auth/AuthRoutes';
import { WorkspacePage } from './pages/WorkspacePage';
import { RequirementsPage } from './pages/RequirementsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { BugsPage } from './pages/BugsPage';
import { DailyTasksPage } from './pages/DailyTasksPage';
import { ReportsDailyPage } from './pages/ReportsDailyPage';
import { ReportsWeeklyPage } from './pages/ReportsWeeklyPage';
import { GanttPage } from './pages/GanttPage';
import { PerformancePage } from './pages/PerformancePage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

const settingsPermissions = [
  'settings.member.manage.org',
  'settings.role.manage.org',
  'settings.policy.manage.org',
  'settings.dictionary.view.org',
  'settings.workflow.view.org',
];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <PublicLoginRoute />,
  },
  {
    path: '/',
    element: <ProtectedAppShell />,
    children: [
      { index: true, element: <WorkspacePage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      {
        path: 'requirements',
        element: (
          <PermissionGuard permission="requirement.view.related">
            <RequirementsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'projects',
        element: (
          <PermissionGuard permission="project.view.related">
            <ProjectsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'executions',
        element: (
          <PermissionGuard permission="execution.view.related">
            <ExecutionsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'bugs',
        element: (
          <PermissionGuard permission="bug.view.related">
            <BugsPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'daily-tasks',
        element: (
          <PermissionGuard permission="daily_task.view.self">
            <DailyTasksPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'reports/daily',
        element: (
          <PermissionGuard permission="report.daily.generate.self">
            <ReportsDailyPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'reports/weekly',
        element: (
          <PermissionGuard permission="report.weekly.generate.self">
            <ReportsWeeklyPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'gantt',
        element: (
          <PermissionGuard permission="schedule.view.related">
            <GanttPage />
          </PermissionGuard>
        ),
      },
      {
        path: 'performance',
        element: (
          <PermissionGuard permission="execution.view.related">
            <PerformancePage />
          </PermissionGuard>
        ),
      },
      {
        path: 'settings',
        element: (
          <PermissionGuard permissions={settingsPermissions}>
            <SettingsPage />
          </PermissionGuard>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);