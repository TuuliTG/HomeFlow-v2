import { common } from '@/locales/en/common';

/** Goals and the rewards they lead to. */
export const rewards = {
  eyebrow: 'Rewards',
  title: 'Rewards & goals',
  description:
    "Doing shared tasks earns points. Points earned after a goal is set count towards it: everyone's for family goals, yours for your own.",
  newGoal: 'New goal',
  loadFailed: "We couldn't load the goals. Check your connection and reload the page.",
  sections: {
    family: {
      heading: 'Family goals',
      empty: 'No family goals yet. Set one everyone can work towards together, like a trip out.',
    },
    yours: {
      heading: 'Your goals',
      empty:
        'Set a goal of your own, like a treat. Only your points count, and the family can cheer you on.',
    },
    // Shown only when other members have goals.
    members: { heading: "Family members' goals", empty: null },
  },
  claimedHeading: 'Rewards claimed',
  /** Whose a claimed reward was: "Family", "Yours" or "Ben's". */
  owner: { family: 'Family', yours: 'Yours', named: (name: string) => `${name}'s` },
  claimedOn: (date: string) => `Claimed ${date}`,
  aFamilyMember: 'A family member',
  goal: {
    othersGoal: (name: string) => `${name}'s goal`,
    minimumFromEach: (minimum: number) => `At least ${common.points(minimum)} from each member`,
    progress: (points: number, target: number) => `${String(points)} / ${String(target)} points`,
    progressLabel: (title: string) => `Progress towards ${title}`,
    progressValue: (points: number, target: number) =>
      `${String(points)} of ${String(target)} points`,
    pointsToGo: (missing: number) =>
      `${missing === 1 ? '1 more point' : `${String(missing)} more points`} to go`,
    membersShort: (count: number) =>
      `Enough points! ${count === 1 ? 'One member still needs' : `${String(count)} members still need`} to earn their share.`,
    othersReached: (name: string) => `${name} reached this goal!`,
    memberPointsLabel: (title: string) => `Points from each member towards ${title}`,
    memberDone: ', done',
    reached: 'Goal reached!',
    claim: 'Claim reward',
    claimLabel: (title: string) => `Claim reward: ${title}`,
    claimFailed: "We couldn't claim the reward. Check your connection and try again.",
    deleteLabel: (title: string) => `Delete goal: ${title}`,
    confirmDelete: (title: string, isFamilyGoal: boolean) =>
      `Delete “${title}”${isFamilyGoal ? ' for everyone in the household' : ''}? This can't be undone.`,
    deleteFailed: "We couldn't delete the goal. Try again.",
  },
  form: {
    description: 'Pick a reward and how many points reach it.',
    reward: 'Reward',
    rewardPlaceholder: 'e.g. Pizza night',
    pointsNeeded: 'Points needed',
    whoFor: "Who it's for",
    scopes: { shared: 'The family', personal: 'Just me' },
    scopeHints: {
      shared: "Everyone's points count towards it, and the whole family sees it.",
      personal: 'Only your points count towards it. The family sees it too and can cheer you on.',
    },
    minimum: 'Minimum points from each member (optional)',
    minimumHint:
      'The goal is reached only once everyone has earned at least this much, so nobody does it all alone.',
    submit: 'Set goal',
    checkDetails: 'Check the goal details.',
    saveFailed: "We couldn't save the goal. Try again.",
    errors: {
      rewardRequired: 'Name the reward.',
      rewardTooLong: (max: number) => `Keep the reward to ${String(max)} characters or fewer.`,
      targetPointsRange: (max: number) =>
        `Points needed must be a whole number from 1 to ${String(max)}.`,
      minimumRange:
        'The minimum from each member must be a whole number from 1 to the points needed.',
      minimumOnlyForFamily: 'Only family goals ask for a minimum from each member.',
    },
  },
};
