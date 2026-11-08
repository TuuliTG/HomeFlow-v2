import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FAKE_PASSWORD, fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Anna is logged in; Ben is her child without email or a device of his own. */
function annaWithBen() {
  const anna = logInAsFamilyMember();
  const ben = fakeHouseholdBackend.addChildAccount('Ben', 'The Virtanens');
  return { anna, ben };
}

const benOnThisDevice = { name: 'Ben is signed in on this device' };

/** Ticks Ben as signed in on this device, and waits until he is. */
async function signBenInHere(user: UserEvent) {
  const box = await screen.findByRole('checkbox', benOnThisDevice);
  await user.click(box);
  await waitFor(() => {
    expect(box).toBeEnabled();
  });
  expect(box).toBeChecked();
}

async function switchTo(user: UserEvent, name: string) {
  await user.click(await screen.findByText(/^Hello, /));
  await user.click(screen.getByRole('button', { name: `Switch to ${name}` }));
}

/** Signs Ben in on this device and continues as him. */
async function useBenOnThisDevice(user: UserEvent) {
  await signBenInHere(user);
  await switchTo(user, 'Ben');
  await screen.findByText('Hello, Ben');
}

describe('switching accounts on one device', () => {
  it('signs a child without a code in on this device while the adult stays', async () => {
    const { anna } = annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');

    await signBenInHere(user);

    expect(fakeAuthBackend.currentUser()?.id).toBe(anna.id);
    expect(screen.getByText('Hello, Anna')).toBeInTheDocument();
  });

  it('lets an adult hand their device to a child signed in here, landing on their Me page', async () => {
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

  it('shows a child signed in here as ticked after switching back', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);
    await switchTo(user, 'Anna');
    await screen.findByText('Hello, Anna');

    await user.click(screen.getByRole('link', { name: 'The Virtanens' }));

    expect(await screen.findByRole('checkbox', benOnThisDevice)).toBeChecked();
  });

  it('signs a child out of this device, ending their session', async () => {
    const { ben } = annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await signBenInHere(user);
    const box = screen.getByRole('checkbox', benOnThisDevice);

    await user.click(box);

    await waitFor(() => {
      expect(box).toBeEnabled();
    });
    expect(box).not.toBeChecked();
    expect(fakeAuthBackend.hasSession(ben.id)).toBe(false);
    expect(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Switch to Ben' })).not.toBeInTheDocument();
  });

  it('keeps the child signed in here when signing them out fails', async () => {
    const { ben } = annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await signBenInHere(user);
    fakeAuthBackend.failRequests();
    const box = screen.getByRole('checkbox', benOnThisDevice);

    await user.click(box);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign the child in or out on this device. Try again.",
    );
    expect(box).toBeChecked();
    expect(fakeAuthBackend.hasSession(ben.id)).toBe(true);
  });

  it("is offered only for other members' child accounts, and only to adults", async () => {
    annaWithBen();
    const carl = fakeAuthBackend.addProfile('carl@example.com', 'Carl');
    fakeHouseholdBackend.addMember(carl.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(carl.id, true);
    const user = userEvent.setup();
    renderAppAt('/household');

    await screen.findByRole('checkbox', benOnThisDevice);
    expect(
      screen.queryByRole('checkbox', { name: 'Carl is signed in on this device' }),
    ).not.toBeInTheDocument();
    await useBenOnThisDevice(user);
    await user.click(screen.getByRole('link', { name: 'The Virtanens' }));
    const members = await screen.findByRole('region', { name: 'Members' });
    await within(members).findByText('Anna');
    expect(screen.queryByRole('checkbox', { name: /on this device/ })).not.toBeInTheDocument();
  });

  it('says so when the child could not be signed in here, and stays with the adult', async () => {
    annaWithBen();
    fakeHouseholdBackend.failRequests();
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('checkbox', benOnThisDevice));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't sign the child in or out on this device. Try again.",
    );
    expect(screen.getByRole('checkbox', benOnThisDevice)).not.toBeChecked();
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

  it("doesn't show the child what was loaded for the adult", async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    expect(await screen.findByRole('heading', { name: 'Invite your family' })).toBeInTheDocument();

    await useBenOnThisDevice(user);
    await user.click(screen.getByRole('link', { name: 'The Virtanens' }));

    await screen.findByRole('region', { name: 'Members' });
    expect(screen.queryByRole('heading', { name: 'Invite your family' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Child's name")).not.toBeInTheDocument();
  });

  it('stops offering an account once it logs in with its password', async () => {
    annaWithBen();
    const user = userEvent.setup();
    renderAppAt('/household');
    await useBenOnThisDevice(user);
    await user.click(screen.getByText('Hello, Ben'));
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await user.type(await screen.findByLabelText('Email'), 'anna@example.com');
    await user.type(screen.getByLabelText('Password'), FAKE_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });

  it('keeps the top bar as it was while only one account is signed in here', async () => {
    logInAsFamilyMember();
    renderAppAt('/');

    expect(await screen.findByRole('button', { name: 'Log out' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Switch to/ })).not.toBeInTheDocument();
  });
});
