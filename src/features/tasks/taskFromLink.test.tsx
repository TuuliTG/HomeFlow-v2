import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('a link to the New task form with task details', () => {
  it('fills in the form for the user to finish', async () => {
    logInAsFamilyMember();
    renderAppAt(
      '/tasks/new?title=Bring%20permission%20slip&description=Sign%20and%20return&due=2026-10-20',
    );

    expect(await screen.findByLabelText('Task')).toHaveValue('Bring permission slip');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Sign and return');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-10-20');
    expect(screen.getByRole('button', { name: 'Create task' })).toBeEnabled();
    expect(fakeTasksBackend.taskCount()).toBe(0);
  });
});
