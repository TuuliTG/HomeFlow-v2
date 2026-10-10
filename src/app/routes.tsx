import { Outlet, type RouteObject } from 'react-router';

import { AppShell } from '@/app/AppShell';
import { NotFoundPage } from '@/app/NotFoundPage';
import { OnboardingGate } from '@/app/OnboardingGate';
import { paths } from '@/app/paths';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { HouseholdPage } from '@/features/household/HouseholdPage';
import { HouseholdSetupPage } from '@/features/household/HouseholdSetupPage';
import { NewsPage } from '@/features/news/NewsPage';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { turnOffNotificationsOnThisDevice } from '@/features/notifications/usePushNotifications';
import { NewGoalPage } from '@/features/rewards/NewGoalPage';
import { RewardsPage } from '@/features/rewards/RewardsPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { SharedTasksPage } from '@/features/tasks/SharedTasksPage';
import { CreateTaskPage } from '@/features/tasks/CreateTaskPage';
import { EditTaskPage } from '@/features/tasks/EditTaskPage';
import { MyTasksPage } from '@/features/tasks/MyTasksPage';

export const routes: RouteObject[] = [
  {
    element: (
      <AuthProvider beforeLogOut={turnOffNotificationsOnThisDevice}>
        <Outlet />
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
          { path: paths.tasks, element: <SharedTasksPage /> },
          { path: paths.newTask, element: <CreateTaskPage /> },
          { path: paths.editTask(':taskId'), element: <EditTaskPage /> },
          {
            path: paths.me,
            element: (
              <>
                <MyTasksPage />
                <NotificationSettings />
              </>
            ),
          },
          { path: paths.news, element: <NewsPage /> },
          { path: paths.rewards, element: <RewardsPage /> },
          { path: paths.newGoal, element: <NewGoalPage /> },
          { path: paths.statistics, element: <StatisticsPage /> },
          { path: paths.household, element: <HouseholdPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
