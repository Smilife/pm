import { createBrowserRouter } from 'react-router-dom';
import { ProtectedAppShell, PublicLoginRoute, PermissionGuard } from './auth/AuthRoutes';
import { WorkspacePage } from './pages/WorkspacePage';
import { RequirementsPage } from './pages/RequirementsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ExecutionsPage } from './pages/ExecutionsPage';
import { DailyTasksPage } from './pages/DailyTasksPage';
import { ReportsDailyPage } from './pages/ReportsDailyPage';
import { ReportsWeeklyPage } from './pages/ReportsWeeklyPage';
import { GanttPage } from './pages/GanttPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
        path: 'settings',
        element: <PlaceholderPage title="Settings" description="Members, roles, policies and workflows will be added in later iterations." />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);