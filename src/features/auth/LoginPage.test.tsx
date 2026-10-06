import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';

describe('LoginPage', () => {
  it('shows a sign-in form without the main navigation', () => {
    renderAppAt('/login');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sign in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('explains that sign-in is not available yet when submitted', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.type(screen.getByLabelText('Email'), 'parent@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('status')).toHaveTextContent("Sign-in isn't available yet.");
  });

  it('lets the user continue to the app without signing in', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.click(screen.getByRole('link', { name: 'Continue without signing in' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
  });
});
