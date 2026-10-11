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

function addChild(email: string, name: string) {
  const child = fakeAuthBackend.addProfile(email, name);
  fakeHouseholdBackend.addMember(child.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(child.id, true);
  return child;
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

type SectionName = 'Shared goals' | 'Your goals' | "Family members' goals";

function section(name: SectionName) {
  return screen.getByRole('region', { name });
}

/** A goal's card in a section, once the goals have loaded. */
async function findGoal(sectionName: SectionName, title: string) {
  const found = await screen.findByRole('region', { name: sectionName });
  return within(found).findByRole('listitem', { name: title });
}

describe('rewards and goals', () => {
  it('sets a shared goal and a personal one, explaining whose points count', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    const { router } = renderAppAt('/rewards');

    expect(await screen.findByText(/No shared goals yet/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'New goal' }));
    expect(await screen.findByRole('radio', { name: 'Together' })).toBeChecked();
    expect(screen.getByText(/The points of everyone taking part count/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Me' })).toBeChecked();
    await user.type(await screen.findByLabelText('Reward'), 'Pizza night');
    await user.clear(screen.getByLabelText('Points needed'));
    await user.type(screen.getByLabelText('Points needed'), '30');
    await user.click(await screen.findByRole('button', { name: 'Set goal' }));

    const pizza = await findGoal('Shared goals', 'Pizza night');
    expect(router.state.location.pathname).toBe('/rewards');
    expect(pizza).toHaveTextContent('0 / 30 points');
    expect(within(pizza).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    await user.click(screen.getByRole('link', { name: 'New goal' }));
    await user.click(await screen.findByRole('radio', { name: 'One person' }));
    expect(screen.getByText(/Only their points count towards it/)).toBeInTheDocument();
    await user.type(await screen.findByLabelText('Reward'), 'New book');
    await user.click(await screen.findByRole('button', { name: 'Set goal' }));

    const book = await findGoal('Your goals', 'New book');
    expect(book).toHaveTextContent('0 / 20 points');
    expect(
      within(section('Shared goals')).queryByRole('listitem', { name: 'New book' }),
    ).not.toBeInTheDocument();
  });

  it("counts everyone's points towards a shared goal for the family and only the user's towards their own", async () => {
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

    const pizza = await findGoal('Shared goals', 'Pizza night');
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

  it("shows other members' goals for the family to cheer on, leaving claiming to them", async () => {
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
    expect(within(sweets).queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
    // Adults can delete any open goal, also a child's or another adult's (ADR 0007).
    expect(within(sweets).getByRole('button', { name: 'Delete goal: Sweets' })).toBeInTheDocument();
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

  it('sets a shared goal for chosen members, asking a younger child for less', async () => {
    logInAsFamilyMember();
    addBen();
    addChild('mia@example.com', 'Mia');
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    const participants = await screen.findByRole('group', { name: 'Who takes part' });
    expect(participants).toHaveAccessibleDescription(/less for a younger child/);
    await user.type(screen.getByLabelText('Reward'), 'Zoo trip');
    await user.click(within(participants).getByRole('checkbox', { name: 'Me' }));
    await user.click(within(participants).getByRole('checkbox', { name: 'Ben' }));
    await user.click(within(participants).getByRole('checkbox', { name: 'Ben' }));
    expect(
      within(participants).queryByLabelText('Minimum points from Me (optional)'),
    ).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Minimum points from Ben (optional)'), '12');
    await user.type(screen.getByLabelText('Minimum points from Mia (optional)'), '4');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));

    const zoo = await findGoal('Shared goals', 'Zoo trip');
    const points = within(zoo).getByRole('list', {
      name: 'Points from each person taking part in Zoo trip',
    });
    expect(
      within(points)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Ben0 / 12', 'Mia0 / 4']);
  });

  it("counts only the participants' points, and leaves claiming to them", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    fakeGoalsBackend.addGoalAs(anna.id, {
      title: 'Zoo trip',
      targetPoints: 10,
      isShared: true,
      participants: [{ userId: ben.id, minPoints: null }],
    });
    doTask(anna.id, 'Vacuum', 20);
    doTask(ben.id, 'Mow the lawn', 12);
    renderAppAt('/rewards');

    const zoo = await findGoal('Shared goals', 'Zoo trip');
    expect(zoo).toHaveTextContent('10 / 10 points');
    expect(zoo).toHaveTextContent('Ben12 points');
    expect(zoo).not.toHaveTextContent('You');
    expect(zoo).toHaveTextContent('Goal reached! Someone taking part claims the reward.');
    expect(within(zoo).queryByRole('button', { name: /Claim/ })).not.toBeInTheDocument();
  });

  it("can't be claimed while a participant hasn't earned their minimum, even with enough points", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    fakeGoalsBackend.addGoalAs(anna.id, {
      title: 'Zoo trip',
      targetPoints: 10,
      isShared: true,
      participants: [
        { userId: anna.id, minPoints: 3 },
        { userId: ben.id, minPoints: 3 },
      ],
    });
    fakeGoalsBackend.addGoalAs(anna.id, {
      title: 'Movie night',
      targetPoints: 10,
      isShared: true,
      participants: [
        { userId: anna.id, minPoints: null },
        { userId: ben.id, minPoints: 1 },
      ],
    });
    doTask(anna.id, 'Vacuum', 9);
    doTask(ben.id, 'Dust', 1);
    renderAppAt('/rewards');

    const zoo = await findGoal('Shared goals', 'Zoo trip');
    expect(zoo).toHaveTextContent('10 / 10 points');
    expect(zoo).toHaveTextContent('Enough points! One person still needs to earn their share.');
    expect(zoo).toHaveTextContent('You3 / 3 ✓, done');
    expect(zoo).toHaveTextContent('Ben1 / 3');
    expect(within(zoo).queryByRole('button', { name: /Claim reward/ })).not.toBeInTheDocument();
    const movie = await findGoal('Shared goals', 'Movie night');
    expect(movie).toHaveTextContent('You9 points');
    expect(within(movie).getByRole('button', { name: 'Claim reward: Movie night' })).toBeEnabled();
  });

  it('asks for someone to take part, and minimums that fit in the points needed', async () => {
    logInAsFamilyMember();
    addBen();
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.type(await screen.findByLabelText('Reward'), 'Zoo trip');
    await user.click(screen.getByRole('checkbox', { name: 'Me' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ben' }));
    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose who takes part.');
    expect(screen.getByRole('checkbox', { name: 'Me' })).toHaveFocus();

    await user.click(screen.getByRole('checkbox', { name: 'Me' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ben' }));
    await user.type(screen.getByLabelText('Minimum points from Me (optional)'), '15');
    await user.type(screen.getByLabelText('Minimum points from Ben (optional)'), '10');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Together the minimums can't be more than the points needed.",
    );
    expect(screen.getByLabelText('Minimum points from Me (optional)')).toHaveFocus();

    await user.clear(screen.getByLabelText('Minimum points from Me (optional)'));
    await user.type(
      screen.getByLabelText('Minimum points from Ben (optional)'),
      '{Backspace}{Backspace}0',
    );
    await user.click(screen.getByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'A minimum must be a whole number of 1 or more.',
    );
    expect(screen.getByLabelText('Minimum points from Ben (optional)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('claims the reward of a reached goal, which then stays as history', async () => {
    const anna = logInAsFamilyMember();
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'Pizza night', targetPoints: 5, isShared: true });
    fakeGoalsBackend.addGoalAs(anna.id, { title: 'New book', targetPoints: 50, isShared: false });
    doTask(anna.id, 'Vacuum', 7);
    const user = userEvent.setup();
    renderAppAt('/rewards');

    const pizza = await findGoal('Shared goals', 'Pizza night');
    expect(pizza).toHaveTextContent('Goal reached!');
    expect(pizza).toHaveTextContent('5 / 5 points');
    expect(
      screen.queryByRole('button', { name: 'Claim reward: New book' }),
    ).not.toBeInTheDocument();
    await user.click(within(pizza).getByRole('button', { name: 'Claim reward: Pizza night' }));

    const claimed = await screen.findByRole('region', { name: 'Rewards claimed' });
    expect(within(claimed).getByRole('listitem')).toHaveTextContent(
      /Pizza night.*Shared · Claimed/,
    );
    expect(section('Shared goals')).toHaveTextContent('No shared goals yet.');
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
    expect(screen.getByText(/Delete “Pizza night” for everyone taking part\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    await user.click(screen.getByRole('button', { name: 'Delete goal: Pizza night' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    expect(await screen.findByText(/No shared goals yet/)).toBeInTheDocument();
  });

  it('asks for a reward and a sensible number of points', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.click(await screen.findByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Name the reward.');
    expect(screen.getByLabelText('Reward')).toHaveFocus();

    await user.type(await screen.findByLabelText('Reward'), 'Holiday');
    await user.clear(screen.getByLabelText('Points needed'));
    await user.type(screen.getByLabelText('Points needed'), '0');
    await user.click(await screen.findByRole('button', { name: 'Set goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Points needed must be a whole number from 1 to 10000.',
    );
    expect(screen.getByLabelText('Points needed')).toHaveAttribute('aria-invalid', 'true');
  });

  it('says so when a goal cannot be saved', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.type(await screen.findByLabelText('Reward'), 'Holiday');
    fakeTasksBackend.failRequests();
    await user.click(await screen.findByRole('button', { name: 'Set goal' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the goal.");
  });

  it('says so when the goals cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/rewards');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the goals.");
  });

  it('can be set by an adult for a child', async () => {
    logInAsFamilyMember();
    const ben = addBen();
    fakeHouseholdBackend.setChild(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/rewards/new');

    await user.type(await screen.findByLabelText('Reward'), 'Football');
    await user.click(screen.getByRole('radio', { name: 'One person' }));
    await user.selectOptions(screen.getByLabelText('Whose goal'), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Set goal' }));

    const football = await findGoal("Family members' goals", 'Football');
    expect(football).toHaveTextContent("Ben's goal");
  });

  it('are claimed by a child but never added or deleted by one', async () => {
    const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = logInAsFamilyMember('ben@example.com', 'Ben');
    fakeHouseholdBackend.setChild(ben.id, true);
    fakeGoalsBackend.addGoalAs(ben.id, { title: 'Football', targetPoints: 2, isShared: false });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 2,
      forChildren: true,
    });
    fakeTasksBackend.completeTaskAs(ben.id, idOf('Feed the cat'), '2026-10-10');
    const user = userEvent.setup();
    renderAppAt('/rewards');

    const football = await findGoal('Your goals', 'Football');
    expect(within(football).getByRole('button', { name: /Claim/ })).toBeInTheDocument();
    expect(within(football).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New goal' })).not.toBeInTheDocument();
    await user.click(within(football).getByRole('button', { name: /Claim/ }));
    expect(
      await within(await screen.findByRole('region', { name: 'Rewards claimed' })).findByText(
        'Football',
      ),
    ).toBeInTheDocument();
  });

  it("aren't set by a child, even from the New goal address", async () => {
    const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = logInAsFamilyMember('ben@example.com', 'Ben');
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt('/rewards/new');

    expect(await screen.findByText(/Only adults set goals/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Reward')).not.toBeInTheDocument();
  });
});
