/** Setting up, joining and showing the household. */
export const household = {
  eyebrow: 'Household',
  yourHousehold: 'Your household',
  loadFailed: "We couldn't load your household. Check your connection and reload the page.",
  setUp: {
    title: 'Set up your household',
    description: 'Tasks are shared with everyone in your household.',
    checkFailed:
      "We couldn't check whether you already have a household. Check your connection and reload the page.",
    startHeading: 'Start a new household',
    joinHeading: 'Join your family',
    joinIntro: "Has someone already set up HomeFlow? Ask them for your household's invite code.",
  },
  create: {
    label: 'Household name',
    submit: 'Create household',
    placeholder: 'e.g. The Virtanens',
    hint: "You'll get an invite code to share with your family.",
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
    intro:
      'Share this code with your family. They enter it after logging in to join your household.',
    copy: 'Copy code',
    copied: 'Copied',
    copyFailed: "Couldn't copy. Select the code instead.",
  },
  members: {
    heading: 'Members',
    loadFailed: "We couldn't load the members.",
    you: ' (you)',
  },
};
