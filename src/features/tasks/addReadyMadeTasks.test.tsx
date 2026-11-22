import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { addChildToFamily, logInAsFamilyMember } from '@/test/session';

/** Opens the list of tasks to start from, by tapping the empty name field. */
async function openSuggestions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText('Task'));
}

/** The task named `title` in the opened list, if it is offered. */
function offered(title: string) {
  const list = screen.getByRole('listbox', { name: 'Suggested tasks' });
  return within(list).queryByRole('option', { name: new RegExp(`^${title}`) });
}

function isOffered(title: string) {
  return offered(title) !== null;
}

async function pick(user: ReturnType<typeof userEvent.setup>, title: string) {
  const option = offered(title);
  if (!option) throw new Error(`${title} isn't offered`);
  await user.click(option);
}

describe('ready-made tasks', () => {
  it("adds an adults' chore with the default points, to adjust before saving", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await openSuggestions(user);
    expect(isOffered('Empty the dishwasher')).toBe(true);
    expect(isOffered('Walk the dog')).toBe(true);
    expect(isOffered('Tidy your room')).toBe(false);
    await pick(user, 'Empty the dishwasher');

    expect(screen.getByLabelText('Task')).toHaveValue('Empty the dishwasher');
    expect(screen.getByLabelText('Points')).toHaveValue(3);
    expect(screen.getByRole('radio', { name: 'Physical' })).toBeChecked();
    expect(screen.getByText('Chosen icon: Dishes')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Points'));
    await user.type(screen.getByLabelText('Points'), '2');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('listitem', { name: 'Empty the dishwasher' });
    expect(tasks).toMatchObject([
      { title: 'Empty the dishwasher', points: 2, icon: 'dishes', labels: ['kitchen'] },
    ]);
  });

  it("offers children's chores, each for one star, on a child's form", async () => {
    logInAsFamilyMember();
    const ben = addChildToFamily();
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    await openSuggestions(user);
    expect(isOffered('Tidy your room')).toBe(true);
    expect(isOffered('Cook dinner')).toBe(false);
    expect(isOffered('Help cook dinner')).toBe(true);
    expect(isOffered('Mop the floors')).toBe(false);
    await pick(user, 'Tidy your room');

    expect(screen.getByLabelText('Task')).toHaveValue('Tidy your room');
    expect(screen.getByRole('radio', { name: '1 star' })).toBeChecked();
  });

  it("keeps what was typed when a ready-made task is picked on a child's form", async () => {
    logInAsFamilyMember();
    const ben = addChildToFamily();
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}/new-task`);

    await user.type(await screen.findByLabelText('Description (optional)'), 'Before Saturday');
    await openSuggestions(user);
    await pick(user, 'Make your bed');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => {
      expect(tasks).toMatchObject([
        {
          title: 'Make your bed',
          description: 'Before Saturday',
          points: 1,
          forChildren: true,
          assignedTo: ben.id,
        },
      ]);
    });
  });

  it("offers a child who may add tasks the children's chores", async () => {
    const anna = fakeAuthBackend.addAccount('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    fakeHouseholdBackend.setCanAddTasks(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await openSuggestions(user);
    expect(isOffered('Make your bed')).toBe(true);
    expect(isOffered('Cook dinner')).toBe(false);
  });

  it('lists matching ready-made tasks after earlier ones while typing a name', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dishes by hand', type: 'physical', points: 2 });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Empty the dishwasher',
      type: 'physical',
      points: 4,
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const name = await screen.findByLabelText('Task');
    await user.type(name, 'dish');

    const suggestions = () =>
      within(screen.getByRole('listbox', { name: 'Suggested tasks' }))
        .getAllByRole('option')
        .map((option) => option.textContent);
    // The household's own "Empty the dishwasher" stands in for the ready-made one. The two earlier tasks come
    // newest first, which depends on whether they were added in the same millisecond, so their order isn't checked.
    expect(suggestions().toSorted()).toEqual([
      'Dishes by handOn the board · 2 points',
      'Empty the dishwasherOn the board · 4 points',
    ]);
    await user.clear(name);
    await user.type(name, 'bath');
    expect(suggestions()).toEqual(['🛁Clean the bathroom3 points']);
  });

  it('lists the most often added earlier tasks before the ready-made ones, before a name is typed', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 2 });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await openSuggestions(user);
    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options[0]).toBe('VacuumOn the board · 2 points');
    // The household's own "Vacuum" stands in for the ready-made one.
    expect(options.filter((option) => option.includes('Vacuum'))).toHaveLength(1);
    expect(options[1]).toBe('🍽️Empty the dishwasher3 points');
  });

  it('starts new tasks with the default points chosen in the settings', async () => {
    logInAsFamilyMember();
    addChildToFamily();
    const user = userEvent.setup();
    renderAppAt('/settings');

    const defaultPoints = await screen.findByRole('combobox', { name: 'Default points for tasks' });
    expect(defaultPoints).toHaveValue('3');
    await user.selectOptions(defaultPoints, '5');
    await user.click(screen.getByRole('link', { name: 'Shared tasks' }));
    await user.click(await screen.findByRole('link', { name: 'New task' }));

    expect(await screen.findByLabelText('Points')).toHaveValue(5);
    await openSuggestions(user);
    await pick(user, 'Vacuum');
    expect(screen.getByLabelText('Points')).toHaveValue(5);
  });

  it("doesn't offer children the default points setting", async () => {
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt('/settings');

    await screen.findByRole('heading', { name: 'Language' });
    expect(
      screen.queryByRole('combobox', { name: 'Default points for tasks' }),
    ).not.toBeInTheDocument();
  });

  it('opens the list with the down arrow, to pick with the keys', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    (await screen.findByLabelText('Task')).focus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(screen.getByLabelText('Task')).toHaveValue('Empty the dishwasher');
  });

  it("doesn't cover the form with the list when a name is left out", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: 'Create task' }));

    expect(screen.getByLabelText('Task')).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the list again with nothing highlighted, so Enter saves rather than picks', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    const name = await screen.findByLabelText('Task');
    await user.click(name);
    await user.keyboard('{ArrowDown}{Escape}');
    await user.click(name);

    expect(name).not.toHaveAttribute('aria-activedescendant');
  });
});
