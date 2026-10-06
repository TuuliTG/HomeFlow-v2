import type { RouteObject } from 'react-router';

import { AppShell } from '@/app/AppShell';
import { NotFoundPage } from '@/app/NotFoundPage';
import { paths } from '@/app/paths';
import { LoginPage } from '@/features/auth/LoginPage';
import { MyTasksPage } from '@/features/my-tasks/MyTasksPage';
import { RewardsPage } from '@/features/rewards/RewardsPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { AvailableTasksPage } from '@/features/tasks/AvailableTasksPage';

export const routes: RouteObject[] = [
  { path: paths.login, element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { path: paths.tasks, element: <AvailableTasksPage /> },
      { path: paths.me, element: <MyTasksPage /> },
      { path: paths.rewards, element: <RewardsPage /> },
      { path: paths.statistics, element: <StatisticsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
