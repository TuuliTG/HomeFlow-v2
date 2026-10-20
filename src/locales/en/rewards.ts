import { common } from '@/locales/en/common';

/** Goals and the rewards they lead to. */
export const rewards = {
  eyebrow: 'Rewards',
  title: 'Rewards & goals',
  newGoal: 'New goal',
  loadFailed: "We couldn't load the goals. Check your connection and reload the page.",
  sections: {
    shared: {
      heading: 'Shared goals',
      empty: 'No shared goals yet.',
    },
    yours: {
      heading: 'Your goals',
      empty: 'No goals of your own yet.',
    },
    // Shown only when other members have goals.
    members: { heading: "Family members' goals", empty: null },
  },
  claimedHeading: 'Rewards claimed',
  /** Whose a claimed reward was: "Shared", "Yours" or "Ben's". */
  owner: { shared: 'Shared', yours: 'Yours', named: (name: string) => `${name}'s` },
  claimedOn: (date: string) => `Claimed ${date}`,
  aFamilyMember: 'A family member',
  /** The short celebration when the user claims a reward. */
  celebration: {
    claimed: (title: string) => `Reward claimed: ${title}!`,
    badge: 'Reward claimed!',
  },
  /** A child's goal on their Me page, as a jar that fills with points. */
  jar: {
    savingFor: 'Saving for',
    ofTarget: (target: number) => `/ ${String(target)}`,
    noGoal: 'No goal yet',
    loadFailed: "We couldn't load your goal.",
  },
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
    reward: 'Reward',
    rewardPlaceholder: 'e.g. Pizza night',
    pointsNeeded: 'Points needed',
    whoFor: "Who it's for",
    scopes: { shared: 'Together', personal: 'One person' },
    scopeHints: {
      shared: 'Everyone taking part earns points towards it.',
      personal: 'Only their points count towards it.',
    },
    whose: 'Whose goal',
    me: 'Me',
    onlyAdults: 'Only adults set goals. Ask an adult in your family for one.',
    participants: 'Who takes part',
    minimum: 'Minimum',
    minimumFor: (name: string) => `Minimum points from ${name} (optional)`,
    hasOpenGoal: (name: string) => `${name} – goal in progress`,
    everyoneHasOpenGoal:
      'Everyone already has a goal of their own in progress. Claim or delete one first.',
    submit: 'Set goal',
    checkDetails: 'Check the goal details.',
    saveFailed: "We couldn't save the goal. Try again.",
    openGoalExists:
      'Someone already has an open goal like this. Claim or delete it before setting the next one.',
    edit: {
      title: 'Edit goal',
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
