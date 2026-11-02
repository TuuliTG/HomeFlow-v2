import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('task icons', () => {
  it('lets a member choose an emoji for a new task from behind a button', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Make your bed');
    expect(screen.queryByRole('button', { name: 'Bed' })).not.toBeInTheDocument();
    const choose = screen.getByRole('button', { name: 'Choose an icon' });
    expect(choose).toHaveAttribute('aria-expanded', 'false');

    await user.click(choose);
    await user.click(screen.getByRole('button', { name: 'Bed' }));

    expect(screen.queryByRole('button', { name: 'Bed' })).not.toBeInTheDocument();
    expect(screen.getByText('Chosen icon: Bed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change icon' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await screen.findByRole('listitem', { name: 'Make your bed' });
    expect(tasks[0]?.icon).toBe('bed');
  });

  it("shows a task's icon when editing it, and can remove it", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Water the plants',
      type: 'physical',
      points: 2,
      icon: 'plants',
    });
    const user = userEvent.setup();
    renderAppAt('/tasks/task:0/edit');

    expect(await screen.findByText('Chosen icon: Plants')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove icon' }));
    expect(screen.getByRole('button', { name: 'Choose an icon' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(tasks[0]?.icon).toBeNull();
  });
});
