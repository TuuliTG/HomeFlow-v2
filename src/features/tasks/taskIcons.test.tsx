import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('task icons', () => {
  it('lets a member give a new task an icon', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Make your bed');
    expect(screen.getByRole('radio', { name: 'No icon' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Bed' }));
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

    expect(await screen.findByRole('radio', { name: 'Plants' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'No icon' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(tasks[0]?.icon).toBeNull();
  });
});
