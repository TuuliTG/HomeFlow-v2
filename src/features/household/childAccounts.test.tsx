import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

describe('children without email', () => {
  it('are added by an adult, who gets a code for the child to sign in with', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Add a child without email' }));
    await user.type(screen.getByLabelText("Child's name"), ' Ben ');
    await user.click(screen.getByRole('button', { name: 'Add child' }));

    const card = await screen.findByRole('region', { name: "Ben's sign-in code" });
    expect(within(card).getByText('KX7P-AAAA')).toBeInTheDocument();
    expect(within(card).getByText(/It works once, until \d+:\d\d\./)).toBeInTheDocument();
    const members = screen.getByRole('region', { name: 'Members' });
    expect(await within(members).findByRole('link', { name: 'Ben Child' })).toBeInTheDocument();
  });

  it('are found in the settings, through the household page', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/settings');

    const family = await screen.findByRole('region', { name: 'Your family' });
    await user.click(within(family).getByRole('link', { name: 'Open The Virtanens' }));

    expect(
      await screen.findByRole('button', { name: 'Add a child without email' }),
    ).toBeInTheDocument();
  });

  it('get a new code from an adult, which replaces the earlier one', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/household');
    await user.click(await screen.findByRole('button', { name: 'Add a child without email' }));
    await user.type(screen.getByLabelText("Child's name"), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Add child' }));
    await screen.findByText('KX7P-AAAA');

    await user.click(await screen.findByRole('link', { name: 'Ben Child' }));
    await user.click(await screen.findByRole('button', { name: 'New sign-in code' }));

    const card = await screen.findByRole('region', { name: "Ben's sign-in code" });
    expect(within(card).getByText('KX7P-AAAB')).toBeInTheDocument();
  });

  it("aren't offered for members who log in with email", async () => {
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt(`/household/members/${ben.id}`);

    await screen.findByRole('switch', { name: 'Can add tasks' });
    expect(screen.queryByRole('button', { name: 'New sign-in code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'On this device' })).not.toBeInTheDocument();
  });

  it('see neither the invite code nor adding a child', async () => {
    const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt('/household');

    expect(await screen.findByRole('region', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Invite your family' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add a child without email' }),
    ).not.toBeInTheDocument();
  });

  it("aren't offered to children in the settings", async () => {
    const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    const user = userEvent.setup();
    renderAppAt('/settings');

    const family = await screen.findByRole('region', { name: 'Your family' });
    await user.click(within(family).getByRole('link', { name: 'Open The Virtanens' }));

    expect(await screen.findByRole('region', { name: 'Members' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add a child without email' }),
    ).not.toBeInTheDocument();
  });

  it('need a name, and adding says so when it fails', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Add a child without email' }));
    await user.click(screen.getByRole('button', { name: 'Add child' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Enter the child's name.");

    fakeHouseholdBackend.failRequests();
    await user.type(screen.getByLabelText("Child's name"), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Add child' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't add the child.");
  });
});

describe('removing a child without email', () => {
  it('is up to an adult, who confirms it first', async () => {
    logInAsFamilyMember();
    fakeHouseholdBackend.addChildAccount('Ben', 'The Virtanens');
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('link', { name: 'Ben Child' }));
    await user.click(await screen.findByRole('button', { name: 'Remove Ben from the family' }));
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    await user.click(screen.getByRole('button', { name: 'Remove Ben from the family' }));
    expect(screen.getByText(/Remove Ben with their points and history/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }));

    const members = await screen.findByRole('region', { name: 'Members' });
    await vi.waitFor(() => {
      expect(within(members).queryByText('Ben')).not.toBeInTheDocument();
    });
  });

  it("isn't offered for members who log in with email, nor to children", async () => {
    logInAsFamilyMember();
    const dan = fakeAuthBackend.addProfile('dan@example.com', 'Dan');
    fakeHouseholdBackend.addMember(dan.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(dan.id, true);
    renderAppAt(`/household/members/${dan.id}`);

    await screen.findByRole('switch', { name: 'Child' });
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('says so when it fails', async () => {
    logInAsFamilyMember();
    fakeHouseholdBackend.addChildAccount('Ben', 'The Virtanens');
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('link', { name: 'Ben Child' }));
    await user.click(await screen.findByRole('button', { name: 'Remove Ben from the family' }));
    fakeHouseholdBackend.failRequests();
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't remove the child.");
  });
});

describe('letting a child add tasks', () => {
  it('is up to an adult, and offered only for children', async () => {
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    const user = userEvent.setup();
    renderAppAt(`/household/members/${ben.id}`);

    const isChild = await screen.findByRole('switch', { name: 'Child' });
    expect(screen.queryByRole('switch', { name: 'Can add tasks' })).not.toBeInTheDocument();
    await user.click(isChild);
    await vi.waitFor(() => {
      expect(fakeHouseholdBackend.isChild(ben.id)).toBe(true);
    });

    const canAdd = await screen.findByRole('switch', { name: 'Can add tasks' });
    expect(canAdd).not.toBeChecked();
    await user.click(canAdd);
    await vi.waitFor(() => {
      expect(fakeHouseholdBackend.canAddTasks(ben.id)).toBe(true);
    });
    expect(canAdd).toBeChecked();
  });
});

describe("a member's page", () => {
  it('offers an adult only whether they are a child', async () => {
    logInAsFamilyMember();
    const bob = fakeAuthBackend.addProfile('bob@example.com', 'Bob');
    fakeHouseholdBackend.addMember(bob.id, 'The Virtanens');
    renderAppAt(`/household/members/${bob.id}`);

    expect(await screen.findByRole('switch', { name: 'Child' })).not.toBeChecked();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Add a task/ })).not.toBeInTheDocument();
  });

  it("doesn't offer making a child without email an adult", async () => {
    logInAsFamilyMember();
    const ben = fakeHouseholdBackend.addChildAccount('Ben', 'The Virtanens');
    renderAppAt(`/household/members/${ben.id}`);

    expect(await screen.findByRole('switch', { name: 'Can add tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Child' })).not.toBeInTheDocument();
  });
});
