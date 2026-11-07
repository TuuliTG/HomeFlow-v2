import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Anna is logged in; Ben is her child without email or a device of his own. */
function annaWithBen() {
  const anna = logInAsFamilyMember();
  const ben = fakeHouseholdBackend.addChildAccount('Ben', 'The Virtanens');
  return { anna, ben };
}

async function useBenOnThisDevice(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Use on this device as Ben' }));
  await screen.findByText('Hello, Ben');
}

async function switchTo(user: UserEvent, name: string) {
  await user.click(await screen.findByText(/^Hello, /));
  await user.click(screen.getByRole('button', { name: `Switch to ${name}` }));
}

describe('switching accounts on one device', () => {
  it('lets an adult hand their device to a child without a code, landing on their Me page', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');

    await useBenOnThisDevice(user);

    expect(fakeAuthBackend.currentUser()?.id).toBe('user:ben@child.homeflow.invalid');
    expect(await screen.findByRole('heading', { name: 'My tasks' })).toBeInTheDocument();
  });

  it('switches back and forth without logging in again', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);

    await switchTo(user, 'Anna');
    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();

    await switchTo(user, 'Ben');
    expect(await screen.findByText('Hello, Ben')).toBeInTheDocument();
  });

  it('switches to a child already signed in here, without making them a new code', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);
    await switchTo(user, 'Anna');
    await screen.findByText('Hello, Anna');
    // Making Ben a new code fails, so only switching can sign him in.
    fakeHouseholdBackend.failRequests();
    await user.click(screen.getByRole('link', { name: 'The Virtanens' }));

    await useBenOnThisDevice(user);

    expect(fakeAuthBackend.currentUser()?.id).toBe('user:ben@child.homeflow.invalid');
  });

  it("is offered only for other members' child accounts, and only to adults", async () => {
    annaWithBen();
    const carl = fakeAuthBackend.addProfile('carl@example.com', 'Carl');
    fakeHouseholdBackend.addMember(carl.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(carl.id, true);
    const user = userEvent.setup();
    renderAppAt('/household');

    await screen.findByRole('button', { name: 'Use on this device as Ben' });
    expect(
      screen.queryByRole('button', { name: 'Use on this device as Carl' }),
    ).not.toBeInTheDocument();
    await useBenOnThisDevice(user);
    await user.click(screen.getByRole('link', { name: 'The Virtanens' }));
    const members = await screen.findByRole('region', { name: 'Members' });
    await within(members).findByText('Anna');
    expect(screen.queryByRole('button', { name: /on this device/ })).not.toBeInTheDocument();
  });

  it('says so when the child could not be signed in here, and stays with the adult', async () => {
    annaWithBen();
    fakeHouseholdBackend.failRequests();
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Use on this device as Ben' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign the child in on this device. Try again.",
    );
    expect(screen.getByText('Hello, Anna')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('keeps the account to switch to when switching fails for lack of a connection', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);
    fakeAuthBackend.failRequests();

    await switchTo(user, 'Anna');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't switch to Anna. Try again.",
    );
    expect(screen.getByText('Hello, Ben')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to Anna' })).toBeEnabled();
  });

  it('forgets an account whose session has ended, and stays with the current one', async () => {
    const { anna } = annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);
    fakeAuthBackend.endSessions(anna.id);

    await switchTo(user, 'Anna');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Anna is no longer signed in on this device.',
    );
    expect(screen.queryByRole('button', { name: 'Switch to Anna' })).not.toBeInTheDocument();
    expect(fakeAuthBackend.currentUser()?.id).toBe('user:ben@child.homeflow.invalid');
  });

  it('offers to continue as the accounts still signed in here after logging out', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);

    await user.click(screen.getByText('Hello, Ben'));
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    const onThisDevice = await screen.findByRole('region', { name: 'Signed in on this device' });
    await user.click(within(onThisDevice).getByRole('button', { name: 'Continue as Anna' }));

    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Switch to Ben' })).not.toBeInTheDocument();
  });

  it('keeps the top bar as it was while only one account is signed in here', async () => {
    logInAsFamilyMember();
    renderAppAt('/');

    expect(await screen.findByRole('button', { name: 'Log out' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });
});
