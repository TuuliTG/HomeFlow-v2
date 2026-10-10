import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeGoalsBackend } from '@/test/fakeGoalsApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

function idOf(title: string): string {
  const task = tasks.find((candidate) => candidate.title === title);
  if (!task) throw new Error(`No task ${title}`);
  return task.id;
}

/** Adds a shared task and marks it done as `userId`. */
function doTask(userId: string, title: string, points: number) {
  fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points });
  fakeTasksBackend.completeTaskAs(userId, idOf(title), '2026-10-10');
}

type SectionName = 'Family goals' | 'Your goals' | "Family members' goals";

function section(name: SectionName) {
  return screen.getByRole('region', { name });
}

/** A goal's card in a section, once the goals have loaded. */
async function findGoal(sectionName: SectionName, title: string) {
  const found = await screen.findByRole('region', { name: sectionName });
  return within(found).findByRole('listitem', { name: title });
}

describe('rewards and goals', () => {
  it('sets a family goal and a personal one, explaining whose points count', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    const { router } = renderAppAt('/rewards');

    expect(await screen.findByText(/No family goals yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'New goal' }));
    expect(screen.getByRole('radio', { name: 'The family' })).toBeChecked();
    expect(screen.getByText(/Everyone's points count towards it/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reward'), 'Pizza night');
    await user.clear(screen.getByLabelText('Points needed'));
    await user.type(screen.getByLabelText('Points needed'), '30');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));

    const pizza = await findGoal('Family goals', 'Pizza night');
    expect(router.state.location.pathname).toBe('/rewards');
    expect(pizza).toHaveTextContent('0 / 30 points');
    expect(within(pizza).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    await user.click(screen.getByRole('link', { name: 'New goal' }));
    await user.click(screen.getByRole('radio', { name: 'Just me' }));
    expect(screen.getByText(/Only your points count towards it/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Reward'), 'New book');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));

    const book = await findGoal('Your goals', 'New book');
    expect(book).toHaveTextContent('0 / 20 points');
    expect(within(section('Family goals')).getAllByRole('listitem')).toHaveLength(1);
  });

  it("counts everyone's points towards family goals and only the user's towards their own", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    doTask(anna.id, 'Old chore', 9);
    fakeTasksBackend.ageCompletions(60_000);
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'Pizza night', targetPoints: 10, isShared: true });
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'New book', targetPoints: 5, isShared: false });
    fakeGoalsBackend.addGoalAs(ben.id, { title: 'Sweets', targetPoints: 5, isShared: false });
    doTask(anna.id, 'Vacuum', 2);
    doTask(ben.id, 'Mow the lawn', 4);
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Diary',
      type: 'meta',
      points: null,
      isPrivate: true,
    });
    fakeTasksBackend.completeTaskAs(anna.id, idOf('Diary'), '2026-10-10');
    renderAppAt('/rewards');

    const pizza = await findGoal('Family goals', 'Pizza night');
    expect(pizza).toHaveTextContent('6 / 10 points');
    expect(pizza).toHaveTextContent('4 more points to go');
    expect(within(pizza).getByRole('progressbar')).toHaveAccessibleName(
      'Progress towards Pizza night',
    );
    const yours = within(section('Your goals')).getAllByRole('listitem');
    expect(yours.map((goal) => goal.getAttribute('aria-label'))).toEqual(['New book']);
    expect(yours[0]).toHaveTextContent('2 / 5 points');
    const sweets = await findGoal("Family members' goals", 'Sweets');
    expect(sweets).toHaveTextContent("Ben's goal");
    expect(sweets).toHaveTextContent('4 / 5 points');
  });

  it("shows other members' goals for the family to cheer on, leaving claiming and deleting to them", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    fakeGoalsBackend.addGoalAs(ben.id, { title: 'Sweets', targetPoints: 5, isShared: false });
    doTask(ben.id, 'Mow the lawn', 6);
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'New book', targetPoints: 5, isShared: false });
    fakeGoalsBackend.addGoalAs(ben.id, { title: 'Cinema', targetPoints: 1, isShared: false });
    fakeGoalsBackend.claimAs('goal:2');
    renderAppAt('/rewards');

    const sweets = await findGoal("Family members' goals", 'Sweets');
    expect(sweets).toHaveTextContent('Ben reached this goal!');
    expect(within(sweets).queryByRole('button')).not.toBeInTheDocument();
    expect(within(section('Your goals')).getByRole('listitem')).toHaveAccessibleName('New book');
    expect(screen.getByRole('region', { name: 'Rewards claimed' })).toHaveTextContent(
      "CinemaBen's · Claimed",
    );
  });

  it("leaves out the members' goals section when nobody else has a goal", async () => {
    const anna = logInAsFamilyMember();
    addBen();
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'New book', targetPoints: 5, isShared: false });
    renderAppAt('/rewards');

    await findGoal('Your goals', 'New book');
    expect(screen.queryByRole('region', { name: "Family members' goals" })).not.toBeInTheDocument();
  });

  it('claims the reward of a reached goal, which then stays as history', async () => {
    const anna = logInAsFamilyMember();
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'Pizza night', targetPoints: 5, isShared: true });
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'New book', targetPoints: 50, isShared: false });
    doTask(anna.id, 'Vacuum', 7);
    const user = userEvent.setup();
    renderAppAt('/rewards');

    const pizza = await findGoal('Family goals', 'Pizza night');
    expect(pizza).toHaveTextContent('Goal reached!');
    expect(pizza).toHaveTextContent('5 / 5 points');
    expect(
      screen.queryByRole('button', { name: 'Claim reward: New book' }),
    ).not.toBeInTheDocument();
    await user.click(within(pizza).getByRole('button', { name: 'Claim reward: Pizza night' }));

    const claimed = await screen.findByRole('region', { name: 'Rewards claimed' });
    expect(within(claimed).getByRole('listitem')).toHaveTextContent(
      /Pizza night.*Family · Claimed/,
    );
    expect(section('Family goals')).toHaveTextContent('No family goals yet.');
  });

  it('shows the reward as claimed when someone else claimed it first', async () => {
    const anna = logInAsFamilyMember();
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'Pizza night', targetPoints: 5, isShared: true });
    doTask(anna.id, 'Vacuum', 5);
    const user = userEvent.setup();
    renderAppAt('/rewards');

    const claim = await screen.findByRole('button', { name: 'Claim reward: Pizza night' });
    fakeGoalsBackend.claimAs('goal:0');
    await user.click(claim);

    // The board refreshes, showing the reward as claimed.
    expect(await screen.findByRole('region', { name: 'Rewards claimed' })).toHaveTextContent(
      'Pizza night',
    );
  });

  it('deletes a goal after asking first', async () => {
    const anna = logInAsFamilyMember();
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'Pizza night', targetPoints: 5, isShared: true });
    const user = userEvent.setup();
    renderAppAt('/rewards');

    await user.click(await screen.findByRole('button', { name: 'Delete goal: Pizza night' }));
    expect(
      screen.getByText(/Delete “Pizza night” for everyone in the household\?/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    await user.click(screen.getByRole('button', { name: 'Delete goal: Pizza night' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByText(/No family goals yet/)).toBeInTheDocument();
  });

  it('asks for a reward and a sensible number of points', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Name the reward.');
    expect(screen.getByLabelText('Reward')).toHaveFocus();

    await user.type(screen.getByLabelText('Reward'), 'Holiday');
    await user.clear(screen.getByLabelText('Points needed'));
    await user.type(screen.getByLabelText('Points needed'), '0');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Points needed must be a whole number from 1 to 10000.',
    );
    expect(screen.getByLabelText('Points needed')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says so when a goal cannot be saved', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.type(screen.getByLabelText('Reward'), 'Holiday');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the goal.");
  });

  it('says so when the goals cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/rewards');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the goals.");
  });
});
