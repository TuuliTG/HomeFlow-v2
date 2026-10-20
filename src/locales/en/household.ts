/** Setting up, joining and showing the household. */
export const household = {
  eyebrow: 'Household',
  yourHousehold: 'Your household',
  loadFailed: "We couldn't load your household. Check your connection and reload the page.",
  setUp: {
    title: 'Set up your household',
    checkFailed:
      "We couldn't check whether you already have a household. Check your connection and reload the page.",
    startHeading: 'Start a new household',
    joinHeading: 'Join your family',
  },
  create: {
    label: 'Household name',
    submit: 'Create household',
    placeholder: 'e.g. The Virtanens',
    nameRequired: 'Give your household a name.',
    failed: "We couldn't create the household. Try again.",
  },
  join: {
    label: 'Invite code',
    submit: 'Join household',
    invalidCode: 'Enter the 8-character invite code.',
    unknownCode: 'No household has this invite code. Check it with your family.',
    failed: "We couldn't join the household. Try again.",
  },
  invite: {
    heading: 'Invite your family',
    copy: 'Copy code',
    copied: 'Copied',
    copyFailed: "Couldn't copy. Select the code instead.",
  },
  members: {
    heading: 'Members',
    loadFailed: "We couldn't load the members.",
    you: ' (you)',
    child: 'Child',
    isChild: (name: string) => `${name} is a child`,
    setChildFailed: "We couldn't save that change. Try again.",
    canAddTasks: 'Can add tasks',
    canAddTasksFor: (name: string) => `${name} can add tasks`,
    setCanAddTasksFailed: "We couldn't save that change. Try again.",
    newCode: 'New sign-in code',
    newCodeFor: (name: string) => `New sign-in code for ${name}`,
    newCodeFailed: "We couldn't make a new code. Try again.",
  },
  family: {
    heading: 'Your family',
    link: (name: string) => `Open ${name}`,
  },
  addChild: {
    heading: 'Add a child without email',
    label: "Child's name",
    submit: 'Add child',
    nameRequired: "Enter the child's name.",
    failed: "We couldn't add the child. Try again.",
  },
  signInCode: {
    heading: (name: string) => `${name}'s sign-in code`,
    howTo: (name: string) =>
      `On ${name}'s device, open HomeFlow, choose “Sign in with a child code” and enter this code.`,
    expires: (time: string) => `It works once, until ${time}.`,
  },
};
