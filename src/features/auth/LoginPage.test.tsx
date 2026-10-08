import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAKE_PASSWORD, fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';

async function submitLogin(
  user: UserEvent,
  { email = 'anna@example.com', password = FAKE_PASSWORD, button = 'Log in' } = {},
) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: button }));
}

async function createAccount(user: UserEvent, options: { email?: string; password?: string } = {}) {
  await user.click(screen.getByRole('button', { name: 'Create an account' }));
  await submitLogin(user, { password: 'a long password', ...options, button: 'Create account' });
}

describe('login', () => {
  it('is where logged-out visitors are sent, without the main navigation', () => {
    renderAppAt('/');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('creates an account, asks for a name, then for a household', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await createAccount(user);
    await user.type(await screen.findByLabelText('Your name'), '  Anna ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up your household' }),
    ).toBeInTheDocument();
  });

  it('lets the password manager tell logging in from a new password', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
    await user.click(screen.getByRole('button', { name: 'Log in instead' }));
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('asks for a longer password before creating an account', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await createAccount(user, { password: 'short' });

    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Use at least 8 characters for your password.',
    );
  });

  it('explains when an account already exists for the email', async () => {
    const user = userEvent.setup();
    fakeAuthBackend.addAccount('anna@example.com', 'Anna');
    renderAppAt('/login');

    await createAccount(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is already an account with this email. Log in instead.',
    );
  });

  it('rejects an invalid email address before sending', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await submitLogin(user, { email: 'not-an-email' });

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
  });

  it('explains when the email or password is wrong', async () => {
    const user = userEvent.setup();
    fakeAuthBackend.addAccount('anna@example.com', 'Anna');
    renderAppAt('/login');

    await submitLogin(user, { password: 'wrong password' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  });

  it('explains when logging in fails for another reason', async () => {
    const user = userEvent.setup();
    fakeAuthBackend.failRequests();
    renderAppAt('/login');

    await submitLogin(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't work.");
  });

  it('asks for a name instead of saving an empty one', async () => {
    const user = userEvent.setup();
    fakeAuthBackend.logInAs('anna@example.com');
    renderAppAt('/login');

    await user.type(await screen.findByLabelText('Your name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.');
  });

  it('takes a returning user straight to the app', async () => {
    const user = userEvent.setup();
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    const { unmount } = renderAppAt('/');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    unmount();
    renderAppAt('/login');

    await submitLogin(user, { email: 'ben@example.com' });

    expect(await screen.findByText('Hello, Ben')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
  });
});

describe('account status', () => {
  it('greets a logged-in user by name and logs them out', async () => {
    const user = userEvent.setup();
    const anna = fakeAuthBackend.logInAs('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    renderAppAt('/me');

    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Hello, Anna')).not.toBeInTheDocument();
  });

  it("shows the email when the user's name can't be loaded", async () => {
    const anna = fakeAuthBackend.logInAs('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    fakeAuthBackend.failLoadingProfiles();
    renderAppAt('/');

    expect(await screen.findByText('Logged in as anna@example.com')).toBeInTheDocument();
  });
});
