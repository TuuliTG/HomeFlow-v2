/** Turning push notifications on and off for this device. */
export const notifications = {
  heading: 'Notifications',
  explanations: {
    unsupported: "This browser can't show notifications from HomeFlow.",
    'needs-home-screen':
      'On iPhone, notifications work once HomeFlow is on your Home Screen: tap Share, then “Add to Home Screen”. Open HomeFlow from there and turn notifications on.',
    checking: 'Checking this device…',
    blocked:
      "Notifications are blocked for HomeFlow. Allow them in your phone's or browser's settings, then come back here.",
    off: "Get notified on this device about your family's tasks.",
    on: "You get notified on this device about your family's tasks.",
  },
  turnOn: 'Turn on notifications',
  turnOff: 'Turn off notifications',
  changeFailed: "We couldn't change notifications. Try again.",
  choices: {
    legend: 'Notify me when',
    kinds: {
      taskAdded: 'someone adds a shared task',
      taskCompleted: 'someone finishes a shared task',
      taskLiked: 'someone gives a thumbs up for a task I did',
      taskCommented: 'someone comments on a task I did or commented on',
      taskRequested: 'someone asks me to do a task',
      requestAnswered: 'someone answers when I ask them to do a task',
      reminder: 'a reminder I set is due',
    },
    allDevices: 'These choices apply to all your devices.',
    saveFailed: "We couldn't save your choice. Try again.",
  },
};
