/** The app shell: navigation, install hint, settings, and the page-not-found and error screens. */
export const app = {
  nav: {
    label: 'Main',
    me: 'Me',
    tasks: 'Shared tasks',
    news: 'News',
    rewards: 'Rewards',
    statistics: 'Statistics',
  },
  /** Names the area where messages like "Ben added Book dentist" appear. */
  toasts: 'Updates',
  installHint: {
    title: 'Add HomeFlow to your Home Screen',
    tapShare: 'Tap',
    share: 'Share',
    then: ', then',
    addToHomeScreen: 'Add to Home Screen',
    benefit: '. HomeFlow then opens like an app and can send you notifications.',
    gotIt: 'Got it',
  },
  notFound: {
    title: 'Page not found',
    description: "This page doesn't exist.",
    backToTasks: 'Back to tasks',
  },
  error: {
    title: 'Something went wrong',
    description: 'HomeFlow ran into a problem. Reload the page to try again.',
    reload: 'Reload',
  },
  language: {
    heading: 'Language',
    label: 'Language of HomeFlow',
    hint: 'Changes the language on this device.',
  },
};
