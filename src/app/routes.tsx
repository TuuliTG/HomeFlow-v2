import { Outlet, type RouteObject } from 'react-router';

import { AppShell } from '@/app/AppShell';
import { ErrorPage } from '@/app/ErrorPage';
import { NotFoundPage } from '@/app/NotFoundPage';
import { OnboardingGate } from '@/app/OnboardingGate';
import { paths } from '@/app/paths';
import { SettingsPage } from '@/app/SettingsPage';
import { UpdateBanner } from '@/app/UpdateBanner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { HouseholdPage } from '@/features/household/HouseholdPage';
import { HouseholdSetupPage } from '@/features/household/HouseholdSetupPage';
import { NewsPage } from '@/features/news/NewsPage';
import { turnOffNotificationsOnThisDevice } from '@/features/notifications/usePushNotifications';
import { EditGoalPage } from '@/features/rewards/EditGoalPage';
import { NewGoalPage } from '@/features/rewards/NewGoalPage';
import { RewardsPage } from '@/features/rewards/RewardsPage';
import { StatisticsPage } from '@/features/statistics/StatisticsPage';
import { SharedTasksPage } from '@/features/tasks/SharedTasksPage';
import { CreateTaskPage } from '@/features/tasks/CreateTaskPage';
import { EditTaskPage } from '@/features/tasks/EditTaskPage';
import { MyTasksPage } from '@/features/tasks/MyTasksPage';
import { AskForTaskPage } from '@/features/tasks/AskForTaskPage';
import { TaskHelpersPage } from '@/features/tasks/TaskHelpersPage';
import { LanguageProvider } from '@/lib/i18n/LanguageProvider';

export const routes: RouteObject[] = [
  {
    element: (
      <LanguageProvider>
        <UpdateBanner />
        <Outlet />
      </LanguageProvider>
    ),
    children: [
      {
        // Inside LanguageProvider, so a crash anywhere below is explained in the user's language.
        element: (
          <AuthProvider beforeLogOut={turnOffNotificationsOnThisDevice}>
            <Outlet />
          </AuthProvider>
        ),
        errorElement: <ErrorPage />,
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
              { path: paths.taskHelpers(':taskId'), element: <TaskHelpersPage /> },
              { path: paths.askForTask(':taskId'), element: <AskForTaskPage /> },
              {
                path: paths.me,
                element: <MyTasksPage />,
              },
              { path: paths.news, element: <NewsPage /> },
              { path: paths.rewards, element: <RewardsPage /> },
              { path: paths.newGoal, element: <NewGoalPage /> },
              { path: paths.editGoal(':goalId'), element: <EditGoalPage /> },
              { path: paths.statistics, element: <StatisticsPage /> },
              { path: paths.household, element: <HouseholdPage /> },
              { path: paths.settings, element: <SettingsPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
