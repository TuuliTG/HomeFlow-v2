import { common } from '@/locales/en/common';

/** Goals and the rewards they lead to. */
export const rewards = {
  eyebrow: 'Rewards',
  title: 'Rewards & goals',
  description:
    'Doing shared tasks earns points. Points earned after a goal is set count towards it: those of everyone taking part in a shared goal, yours for your own.',
  newGoal: 'New goal',
  loadFailed: "We couldn't load the goals. Check your connection and reload the page.",
  sections: {
    shared: {
      heading: 'Shared goals',
      empty:
        'No shared goals yet. An adult can set one for the family, or a few of you, to work towards together, like a trip out.',
    },
    yours: {
      heading: 'Your goals',
      empty:
        'No goals of your own yet, like a treat. An adult sets them; only your points count, and the family can cheer you on.',
    },
    // Shown only when other members have goals.
    members: { heading: "Family members' goals", empty: null },
  },
  claimedHeading: 'Rewards claimed',
  /** Whose a claimed reward was: "Shared", "Yours" or "Ben's". */
  owner: { shared: 'Shared', yours: 'Yours', named: (name: string) => `${name}'s` },
  claimedOn: (date: string) => `Claimed ${date}`,
  aFamilyMember: 'A family member',
  goal: {
    othersGoal: (name: string) => `${name}'s goal`,
    progress: (points: number, target: number) => `${String(points)} / ${String(target)} points`,
    progressLabel: (title: string) => `Progress towards ${title}`,
    progressValue: (points: number, target: number) =>
      `${String(points)} of ${String(target)} points`,
    pointsToGo: (missing: number) =>
      `${missing === 1 ? '1 more point' : `${String(missing)} more points`} to go`,
    participantsShort: (count: number) =>
      `Enough points! ${count === 1 ? 'One person still needs' : `${String(count)} people still need`} to earn their share.`,
    othersReached: (name: string) => `${name} reached this goal!`,
    participantsReached: 'Goal reached! Someone taking part claims the reward.',
    participantsLabel: (title: string) => `Points from each person taking part in ${title}`,
    participantPoints: (points: number) => common.points(points),
    participantDone: ', done',
    reached: 'Goal reached!',
    claim: 'Claim reward',
    claimLabel: (title: string) => `Claim reward: ${title}`,
    claimFailed: "We couldn't claim the reward. Check your connection and try again.",
    edit: 'Edit',
    editLabel: (title: string) => `Edit goal: ${title}`,
    deleteLabel: (title: string) => `Delete goal: ${title}`,
    confirmDelete: (title: string, isShared: boolean) =>
      `Delete “${title}”${isShared ? ' for everyone taking part' : ''}? This can't be undone.`,
    deleteFailed: "We couldn't delete the goal. Try again.",
  },
  form: {
    description: 'Pick a reward and how many points reach it.',
    reward: 'Reward',
    rewardPlaceholder: 'e.g. Pizza night',
    pointsNeeded: 'Points needed',
    whoFor: "Who it's for",
    scopes: { shared: 'Together', personal: 'One person' },
    scopeHints: {
      shared: 'The points of everyone taking part count towards it, and the whole family sees it.',
      personal: 'Only their points count towards it. The family sees it too and can cheer them on.',
    },
    whose: 'Whose goal',
    me: 'Me',
    onlyAdults: 'Only adults set goals. Ask an adult in your family for one.',
    participants: 'Who takes part',
    participantsHint:
      'You can ask each one for a minimum, e.g. less for a younger child. The goal is reached only once everyone has earned theirs, so nobody does it all alone.',
    minimum: 'Minimum',
    minimumFor: (name: string) => `Minimum points from ${name} (optional)`,
    submit: 'Set goal',
    checkDetails: 'Check the goal details.',
    saveFailed: "We couldn't save the goal. Try again.",
    edit: {
      title: 'Edit goal',
      description:
        "Change the reward, the points or who it's for. Points already earned still count.",
      submit: 'Save changes',
      notFound: "This goal can't be changed: it may have been claimed or deleted.",
      backToRewards: 'Back to rewards',
    },
    errors: {
      rewardRequired: 'Name the reward.',
      rewardTooLong: (max: number) => `Keep the reward to ${String(max)} characters or fewer.`,
      targetPointsRange: (max: number) =>
        `Points needed must be a whole number from 1 to ${String(max)}.`,
      participantsRequired: 'Choose who takes part.',
      minimumRange: 'A minimum must be a whole number of 1 or more.',
      minimumsTooHigh: "Together the minimums can't be more than the points needed.",
    },
  },
};
