import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('AppShell', () => {
  beforeEach(() => {
    logInAsFamilyMember();
  });

  it('shows the shared tasks screen by default', async () => {
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Shared tasks' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Shared tasks' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['Me', 'My tasks'],
    ['Rewards', 'Rewards & goals'],
    ['Statistics', 'Fairness & progress'],
    ['Shared tasks', 'Shared tasks'],
  ])('navigates to %s', async (linkName, heading) => {
    const user = userEvent.setup();
    renderAppAt('/statistics');

    await user.click(await screen.findByRole('link', { name: linkName }));

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: linkName })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a not-found page with a way back for unknown routes', async () => {
    const user = userEvent.setup();
    renderAppAt('/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to tasks' }));
    expect(await screen.findByRole('heading', { name: 'Shared tasks' })).toBeInTheDocument();
  });
});
