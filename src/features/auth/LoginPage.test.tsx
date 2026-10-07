import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderAppAt } from '@/test/renderWithRouter';

describe('mock login', () => {
  it('offers a log-in link in the app when nobody is logged in', async () => {
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(screen.getByRole('link', { name: 'Log in' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('greets the user by name after logging in, and logs out again', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.type(screen.getByLabelText('Your name'), '  Anna ');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
    expect(screen.getByText('Hello, Anna')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(screen.queryByText('Hello, Anna')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument();
  });

  it('remembers the logged-in name across app reloads', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAppAt('/login');
    await user.type(screen.getByLabelText('Your name'), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    unmount();

    renderAppAt('/me');

    expect(screen.getByText('Hello, Ben')).toBeInTheDocument();
  });

  it('asks for a name instead of logging in with an empty one', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.type(screen.getByLabelText('Your name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name to log in.');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
  });

  it('lets the user continue to the app without logging in', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.click(screen.getByRole('link', { name: 'Continue without logging in' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
  });
});
