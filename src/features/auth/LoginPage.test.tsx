import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAKE_LOGIN_CODE, fakeAuthBackend } from '@/test/fakeAuthApi';
import { renderAppAt } from '@/test/renderWithRouter';

async function requestCode(user: UserEvent, email = 'anna@example.com') {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
}

async function enterCode(user: UserEvent, code = FAKE_LOGIN_CODE) {
  await user.type(await screen.findByLabelText('Login code'), code);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('login', () => {
  it('opens from the log-in link and shows no main navigation', async () => {
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(screen.getByRole('link', { name: 'Log in' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('emails a login code and asks for it', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user);

    expect(await screen.findByText(/We sent an email to/)).toHaveTextContent(
      'We sent an email to anna@example.com',
    );
    expect(screen.getByLabelText('Login code')).toHaveFocus();
  });

  it('rejects an invalid email address before sending', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user, 'not-an-email');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(screen.queryByLabelText('Login code')).not.toBeInTheDocument();
  });

  it('explains when the code cannot be sent', async () => {
    fakeAuthBackend.failSendingCodes();
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't send the code (Email rate limit exceeded).",
    );
  });

  it('explains when the code is wrong', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user);
    await enterCode(user, '999999');

    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work.");
  });

  it('lets the user go back and use a different email', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user);
    await user.click(await screen.findByRole('button', { name: 'Use a different email' }));

    expect(screen.getByLabelText('Email')).toHaveValue('anna@example.com');
  });

  it('asks a first-time user for their name, then greets them', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await requestCode(user);
    await enterCode(user);
    await user.type(await screen.findByLabelText('Your name'), '  Anna ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Available tasks' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hello, Anna')).toBeInTheDocument();
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
    fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    const { unmount } = renderAppAt('/');
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    unmount();
    renderAppAt('/login');

    await requestCode(user, 'ben@example.com');
    await enterCode(user);

    expect(await screen.findByText('Hello, Ben')).toBeInTheDocument();
  });

  it('lets the user continue to the app without logging in', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.click(screen.getByRole('link', { name: 'Continue without logging in' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Available tasks' })).toBeInTheDocument();
  });
});

describe('account status', () => {
  it('greets a logged-in user by name and logs them out', async () => {
    const user = userEvent.setup();
    fakeAuthBackend.logInAs('anna@example.com', 'Anna');
    renderAppAt('/me');

    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByText('Hello, Anna')).not.toBeInTheDocument();
  });

  it('shows the email when the user has not chosen a name yet', async () => {
    fakeAuthBackend.logInAs('anna@example.com');
    renderAppAt('/');

    expect(await screen.findByText('Logged in as anna@example.com')).toBeInTheDocument();
  });
});
