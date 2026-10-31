import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { MAX_TASK_LABELS } from '@/lib/taskLabels';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('task labels', () => {
  it('lets a member give a new task ready-made labels and one of their own', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Empty the dishwasher');
    expect(screen.queryByRole('checkbox', { name: 'Kitchen' })).not.toBeInTheDocument();
    const choose = screen.getByRole('button', { name: 'Choose labels' });
    expect(choose).toHaveAttribute('aria-expanded', 'false');

    await user.click(choose);
    await user.click(screen.getByRole('checkbox', { name: 'Kitchen' }));
    // Enter adds the label rather than saving the task.
    await user.type(screen.getByLabelText('Your own label'), '  Dishwasher {Enter}');
    expect(screen.getByRole('checkbox', { name: 'Dishwasher' })).toBeChecked();
    expect(screen.getByLabelText('Your own label')).toHaveValue('');
    expect(screen.getByText('Labels: Kitchen and Dishwasher')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const card = await screen.findByRole('listitem', { name: 'Empty the dishwasher' });
    expect(within(card).getByText('Kitchen')).toBeInTheDocument();
    expect(within(card).getByText('Dishwasher')).toBeInTheDocument();
    expect(tasks[0]).toMatchObject({ labels: ['kitchen'], customLabels: ['Dishwasher'] });
  });

  it("offers the household's own labels, and picks a ready-made or known one for a name typed again", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Wipe the table',
      type: 'physical',
      points: 1,
      customLabels: ['Evenings'],
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Load the dishwasher');
    await user.click(screen.getByRole('button', { name: 'Choose labels' }));
    expect(await screen.findByRole('checkbox', { name: 'Evenings' })).not.toBeChecked();
    await user.type(screen.getByLabelText('Your own label'), 'evenings');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Your own label'), 'KITCHEN');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('listitem', { name: 'Load the dishwasher' });
    expect(tasks[1]).toMatchObject({ labels: ['kitchen'], customLabels: ['Evenings'] });
  });

  it('keeps labels only on private tasks of other members hidden', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeTasksBackend.addTaskAs(ben.id, {
      title: 'Book a dentist',
      type: 'meta',
      points: null,
      isPrivate: true,
      customLabels: ['Health'],
    });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Feed the cat',
      type: 'physical',
      points: 1,
      customLabels: ['Mornings'],
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.click(await screen.findByRole('button', { name: 'Choose labels' }));

    expect(await screen.findByRole('checkbox', { name: 'Mornings' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Health' })).not.toBeInTheDocument();
  });

  it("shows a task's labels when editing it, and can change them", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Walk the dog',
      type: 'physical',
      points: 2,
      labels: ['pets'],
      customLabels: ['Mornings'],
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    expect(await screen.findByText('Labels: Pets and Mornings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Choose labels' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mornings' }));
    await user.click(screen.getByRole('checkbox', { name: 'Garden and yard' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('listitem', { name: 'Walk the dog' });
    expect(tasks[0]).toMatchObject({ labels: ['pets', 'garden'], customLabels: [] });
  });

  it('stops offering more labels once a task has as many as it can', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Spring cleaning',
      type: 'physical',
      points: 5,
      labels: ['kitchen', 'cooking', 'cleaning', 'laundry', 'tidying', 'shopping', 'children'],
      customLabels: ['One', 'Two', 'Three'],
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    await user.click(await screen.findByRole('button', { name: 'Choose labels' }));

    expect(screen.getByRole('checkbox', { name: 'Pets' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Kitchen' })).toBeEnabled();
    expect(screen.getByLabelText('Your own label')).toBeDisabled();
    expect(
      screen.getByText(`A task can have up to ${String(MAX_TASK_LABELS)} labels.`),
    ).toBeInTheDocument();
  });

  it('keeps the labels when a repeating task comes back and when it is added again', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Take out trash',
      type: 'physical',
      points: 1,
      repeatEveryDays: 7,
      labels: ['cleaning'],
      customLabels: ['Bins'],
    });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-31');
    expect(tasks[1]).toMatchObject({ labels: ['cleaning'], customLabels: ['Bins'] });

    const user = userEvent.setup();
    renderAppAt('/tasks/new');
    await user.type(await screen.findByLabelText('Task'), 'Take out');
    await user.click(await screen.findByRole('option', { name: /Take out trash/ }));

    expect(screen.getByText('Labels: Cleaning and Bins')).toBeInTheDocument();
  });
});
