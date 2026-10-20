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
    off: 'Get notified on this device when someone adds a task.',
    on: 'You get notified on this device when someone adds a task.',
  },
  turnOn: 'Turn on notifications',
  turnOff: 'Turn off notifications',
  changeFailed: "We couldn't change notifications. Try again.",
};
