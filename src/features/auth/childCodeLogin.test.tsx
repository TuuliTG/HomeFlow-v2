import { screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';

/** Ben is a child without email in Anna's household, with the sign-in code KX7P29QF. */
function addBenWithCode() {
  const anna = fakeAuthBackend.addAccount('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const ben = fakeAuthBackend.addProfile('ben@child.homeflow.invalid', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  fakeAuthBackend.setChildCode(ben, 'KX7P29QF');
}

async function signInWithCode(user: UserEvent, code: string) {
  await user.click(screen.getByRole('button', { name: 'I have a child code' }));
  await user.type(screen.getByLabelText('Sign-in code'), code);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('signing in with a child code', () => {
  it('takes a child without email straight into the app, however the code is typed', async () => {
    addBenWithCode();
    const user = userEvent.setup();
    renderAppAt('/login');

    await signInWithCode(user, 'kx7p-29qf');

    expect(await screen.findByText('Hello, Ben')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('explains a code that does not work', async () => {
    addBenWithCode();
    const user = userEvent.setup();
    renderAppAt('/login');

    await signInWithCode(user, 'ABCD-EFGH');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "This code doesn't work. Ask an adult in your family for a new one.",
    );
  });

  it('asks for the whole code before trying it', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await signInWithCode(user, 'KX7P');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter the 8-character code.');
    expect(screen.getByLabelText('Sign-in code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('goes back to logging in with email', async () => {
    const user = userEvent.setup();
    renderAppAt('/login');

    await user.click(screen.getByRole('button', { name: 'I have a child code' }));
    await user.click(screen.getByRole('button', { name: 'Log in with email instead' }));

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
