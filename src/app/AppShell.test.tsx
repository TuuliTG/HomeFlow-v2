import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
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

  it('opens the settings from the gear at the top', async () => {
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Settings' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('region', { name: 'Your family' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Language' })).toBeInTheDocument();
  });

  it('shows a not-found page with a way back for unknown routes', async () => {
    const user = userEvent.setup();
    renderAppAt('/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to tasks' }));
    expect(await screen.findByRole('heading', { name: 'Shared tasks' })).toBeInTheDocument();
  });
});

describe('AppShell for children', () => {
  beforeEach(() => {
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
  });

  it('has only the Me and Shared tasks tabs', async () => {
    renderAppAt('/me');

    expect(await screen.findByRole('heading', { level: 1, name: 'My stars' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Me' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Shared tasks' })).toBeInTheDocument();
  });

  it.each(['/news', '/rewards', '/rewards/new', '/statistics'])(
    'sends them from %s to their Me page',
    async (path) => {
      renderAppAt(path);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'My stars' }),
      ).toBeInTheDocument();
    },
  );
});
