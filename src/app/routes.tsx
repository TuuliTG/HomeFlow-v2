import { Outlet, type RouteObject } from 'react-router';

import { AppShell } from '@/app/AppShell';
import { NotFoundPage } from '@/app/NotFoundPage';
import { OnboardingGate } from '@/app/OnboardingGate';
import { paths } from '@/app/paths';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { HouseholdPage } from '@/features/household/HouseholdPage';
import { HouseholdSetupPage } from '@/features/household/HouseholdSetupPage';
import { MyTasksPage } from '@/features/my-tasks/MyTasksPage';
import { RewardsPage } from '@/features/rewards/RewardsPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { AvailableTasksPage } from '@/features/tasks/AvailableTasksPage';
import { CreateTaskPage } from '@/features/tasks/CreateTaskPage';
import { TasksProvider } from '@/features/tasks/TasksProvider';

export const routes: RouteObject[] = [
  {
    element: (
      <AuthProvider>
        <TasksProvider>
          <Outlet />
        </TasksProvider>
      </AuthProvider>
    ),
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.householdSetup, element: <HouseholdSetupPage /> },
      {
        element: (
          <OnboardingGate>
            <AppShell />
          </OnboardingGate>
        ),
        children: [
          { path: paths.tasks, element: <AvailableTasksPage /> },
          { path: paths.newTask, element: <CreateTaskPage /> },
          { path: paths.me, element: <MyTasksPage /> },
          { path: paths.rewards, element: <RewardsPage /> },
          { path: paths.statistics, element: <StatisticsPage /> },
          { path: paths.household, element: <HouseholdPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
