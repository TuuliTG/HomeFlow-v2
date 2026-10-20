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

    await user.type(await screen.findByLabelText("Child's name"), ' Ben ');
    await user.click(screen.getByRole('button', { name: 'Add child' }));

    const card = await screen.findByRole('region', { name: "Ben's sign-in code" });
    expect(within(card).getByText('KX7P-AAAA')).toBeInTheDocument();
    expect(within(card).getByText(/It works once, until \d+:\d\d\./)).toBeInTheDocument();
    const members = screen.getByRole('region', { name: 'Members' });
    expect(await within(members).findByRole('checkbox', { name: 'Ben is a child' })).toBeChecked();
  });

  it('are found in the settings, through the household page', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/settings');

    const family = await screen.findByRole('region', { name: 'Your family' });
    await user.click(within(family).getByRole('link', { name: 'Open The Virtanens' }));

    expect(await screen.findByLabelText("Child's name")).toBeInTheDocument();
  });

  it('get a new code from an adult, which replaces the earlier one', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/household');
    await user.type(await screen.findByLabelText("Child's name"), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Add child' }));
    await screen.findByText('KX7P-AAAA');

    await user.click(await screen.findByRole('button', { name: 'New sign-in code for Ben' }));

    expect(await screen.findByText('KX7P-AAAB')).toBeInTheDocument();
    expect(screen.queryByText('KX7P-AAAA')).not.toBeInTheDocument();
  });

  it("aren't offered for members who log in with email", async () => {
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    renderAppAt('/household');

    await screen.findByRole('checkbox', { name: 'Ben is a child' });
    expect(screen.queryByRole('button', { name: /New sign-in code/ })).not.toBeInTheDocument();
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
    expect(screen.queryByLabelText("Child's name")).not.toBeInTheDocument();
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
    expect(screen.queryByLabelText("Child's name")).not.toBeInTheDocument();
  });

  it('need a name, and adding says so when it fails', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Add child' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Enter the child's name.");

    fakeHouseholdBackend.failRequests();
    await user.type(screen.getByLabelText("Child's name"), 'Ben');
    await user.click(screen.getByRole('button', { name: 'Add child' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't add the child.");
  });
});

describe('letting a child add tasks', () => {
  it('is up to an adult, and offered only for children', async () => {
    logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    const user = userEvent.setup();
    renderAppAt('/household');

    await screen.findByRole('checkbox', { name: 'Ben is a child' });
    expect(screen.queryByRole('checkbox', { name: 'Ben can add tasks' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Ben is a child' }));

    const canAdd = await screen.findByRole('checkbox', { name: 'Ben can add tasks' });
    expect(canAdd).not.toBeChecked();
    await user.click(canAdd);
    await vi.waitFor(() => {
      expect(fakeHouseholdBackend.canAddTasks(ben.id)).toBe(true);
    });
    expect(canAdd).toBeChecked();
  });
});
