import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';

describe('AppShell', () => {
  it('shows the available tasks screen by default', () => {
    renderAppAt('/');

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute('aria-current', 'page');
  });

  it.each([
    ['Me', 'My tasks'],
    ['Rewards', 'Rewards & goals'],
    ['Statistics', 'Fairness & progress'],
    ['Tasks', 'Available tasks'],
  ])('navigates to %s', async (linkName, heading) => {
    const user = userEvent.setup();
    renderAppAt('/statistics');

    await user.click(screen.getByRole('link', { name: linkName }));

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: linkName })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a not-found page with a way back for unknown routes', async () => {
    const user = userEvent.setup();
    renderAppAt('/does-not-exist');

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to tasks' }));
    expect(screen.getByRole('heading', { name: 'Available tasks' })).toBeInTheDocument();
  });
});
