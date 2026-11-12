import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('repeating a task at a custom interval', () => {
  beforeEach(() => {
    logInAsFamilyMember();
  });

  it('can repeat every chosen number of days', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Water the plants');
    expect(screen.queryByLabelText('Every')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Custom…');
    await user.type(screen.getByLabelText('Every'), '10');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(within(task).getByText('Every 10 days')).toBeInTheDocument();
  });

  it('can repeat every chosen number of weeks', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Clean the fridge');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Custom…');
    await user.type(screen.getByLabelText('Every'), '3');
    await user.selectOptions(screen.getByLabelText('Days or weeks'), 'weeks');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Clean the fridge' });
    expect(within(task).getByText('Every 3 weeks')).toBeInTheDocument();
  });

  it('asks for an interval of at most a year', async () => {
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Defrost the freezer');
    await user.selectOptions(screen.getByLabelText('Repeats'), 'Custom…');
    await user.type(screen.getByLabelText('Every'), '53');
    await user.selectOptions(screen.getByLabelText('Days or weeks'), 'weeks');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose how often it repeats: every 1 to 365 days.',
    );
    expect(screen.getByLabelText('Every')).toHaveFocus();
    expect(screen.getByLabelText('Every')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows and changes a custom interval when editing', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Water the plants',
      type: 'physical',
      points: 2,
      repeatEveryDays: 10,
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    expect(await screen.findByLabelText('Repeats')).toHaveDisplayValue('Custom…');
    expect(screen.getByLabelText('Every')).toHaveValue(10);
    expect(screen.getByLabelText('Days or weeks')).toHaveDisplayValue('days');

    await user.clear(screen.getByLabelText('Every'));
    await user.type(screen.getByLabelText('Every'), '4');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(within(task).getByText('Every 4 days')).toBeInTheDocument();
  });
});
