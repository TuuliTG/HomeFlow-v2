import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';

const POINTS_ERROR = 'Points must be a whole number from 1 to 10.';

describe('creating a task', () => {
  it('shows an empty task list until a task is created', () => {
    renderAppAt('/');

    expect(screen.getByText('No tasks yet. Create the first one!')).toBeInTheDocument();
  });

  it('adds a new task to the available tasks list', async () => {
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(screen.getByRole('link', { name: 'New task' }));
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Task'), '  Book dentist  ');
    await user.click(screen.getByRole('radio', { name: 'Planning' }));
    await user.clear(screen.getByLabelText('Points'));
    await user.type(screen.getByLabelText('Points'), '5');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
    const task = screen.getByRole('listitem', { name: 'Book dentist' });
    expect(within(task).getByText('Planning')).toBeInTheDocument();
    expect(within(task).getByText('5 points')).toBeInTheDocument();
  });

  it('defaults to a physical task worth 3 points', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(screen.getByLabelText('Task'), 'Vacuum');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = screen.getByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Physical')).toBeInTheDocument();
    expect(within(task).getByText('3 points')).toBeInTheDocument();
  });

  it('keeps created tasks while navigating between screens', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');
    await user.type(screen.getByLabelText('Task'), 'Water plants');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await user.click(screen.getByRole('link', { name: 'Me' }));
    await user.click(screen.getByRole('link', { name: 'Tasks' }));

    expect(screen.getByRole('listitem', { name: 'Water plants' })).toBeInTheDocument();
  });

  it.each([
    { case: 'an empty name', title: '   ', points: '3', message: 'Give the task a name.' },
    { case: 'too few points', title: 'Dishes', points: '0', message: POINTS_ERROR },
    { case: 'too many points', title: 'Dishes', points: '11', message: POINTS_ERROR },
    { case: 'fractional points', title: 'Dishes', points: '2.5', message: POINTS_ERROR },
  ])('refuses to create a task with $case', async ({ title, points, message }) => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(screen.getByLabelText('Task'), title);
    await user.clear(screen.getByLabelText('Points'));
    await user.type(screen.getByLabelText('Points'), points);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('heading', { level: 1, name: 'New task' })).toBeInTheDocument();
  });

  it('points out and focuses the field that needs fixing', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(screen.getByLabelText('Task'), 'Dishes');
    await user.clear(screen.getByLabelText('Points'));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const points = screen.getByLabelText('Points');
    expect(points).toHaveFocus();
    expect(points).toHaveAttribute('aria-invalid', 'true');
    expect(points).toHaveAccessibleDescription(POINTS_ERROR);
    expect(screen.getByLabelText('Task')).toHaveAttribute('aria-invalid', 'false');
  });

  it('limits task names to 80 characters', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(screen.getByLabelText('Task'), 'a'.repeat(90));

    expect(screen.getByLabelText('Task')).toHaveValue('a'.repeat(80));
  });

  it('can be cancelled without creating a task', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(screen.getByLabelText('Task'), 'Laundry');
    await user.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Laundry' })).not.toBeInTheDocument();
  });
});
