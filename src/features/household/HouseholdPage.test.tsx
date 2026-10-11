import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';

function copyStatus() {
  return within(screen.getByRole('region', { name: 'Invite your family' })).getByRole('status');
}

function logInWithHousehold() {
  const anna = fakeAuthBackend.logInAs('anna@example.com', 'Anna');
  return fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
}

describe('household page', () => {
  it('opens from the household name at the top of the app', async () => {
    const user = userEvent.setup();
    logInWithHousehold();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'The Virtanens' }));

    expect(screen.getByRole('heading', { level: 1, name: 'The Virtanens' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invite your family' })).toBeInTheDocument();
  });

  it('copies the invite code to share', async () => {
    const user = userEvent.setup();
    const { inviteCode } = logInWithHousehold();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Copy code' }));

    await vi.waitFor(() => {
      expect(copyStatus()).toHaveTextContent('Copied');
    });
    await expect(navigator.clipboard.readText()).resolves.toBe(inviteCode);
  });

  it('says so when the code cannot be copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Not allowed'));
    logInWithHousehold();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Copy code' }));

    await vi.waitFor(() => {
      expect(copyStatus()).toHaveTextContent("Couldn't copy.");
    });
  });

  it('says so when the browser offers no clipboard', async () => {
    const user = userEvent.setup();
    Reflect.deleteProperty(navigator, 'clipboard');
    logInWithHousehold();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Copy code' }));

    await vi.waitFor(() => {
      expect(copyStatus()).toHaveTextContent("Couldn't copy.");
    });
  });

  it('lists members who have not chosen a name yet', async () => {
    const { name } = logInWithHousehold();
    fakeHouseholdBackend.addMember('user:ben@example.com', name);
    renderAppAt('/household');

    expect(await screen.findByText('New member (no name yet)')).toBeInTheDocument();
  });

  it('lets an adult mark another member as a child, and back', async () => {
    const user = userEvent.setup();
    const { name } = logInWithHousehold();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, name);
    renderAppAt('/household');

    const benIsChild = await screen.findByRole('checkbox', { name: 'Ben is a child' });
    expect(screen.queryByRole('checkbox', { name: 'Anna is a child' })).not.toBeInTheDocument();
    await user.click(benIsChild);
    await vi.waitFor(() => {
      expect(fakeHouseholdBackend.isChild(ben.id)).toBe(true);
    });
    expect(benIsChild).toBeChecked();

    await user.click(benIsChild);
    await vi.waitFor(() => {
      expect(benIsChild).not.toBeChecked();
    });
    expect(fakeHouseholdBackend.isChild(ben.id)).toBe(false);
  });

  it('shows a child who the children are, without letting them change it', async () => {
    const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    fakeHouseholdBackend.setChild(ben.id, true);
    renderAppAt('/household');

    const members = await screen.findByRole('region', { name: 'Members' });
    const [annaItem, benItem] = await within(members).findAllByRole('listitem');
    expect(annaItem).toHaveTextContent(/^Anna$/);
    expect(benItem).toHaveTextContent(/^Ben \(you\)Child$/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says so when marking a child fails', async () => {
    const user = userEvent.setup();
    const { name } = logInWithHousehold();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, name);
    renderAppAt('/household');

    const benIsChild = await screen.findByRole('checkbox', { name: 'Ben is a child' });
    fakeHouseholdBackend.failRequests();
    await user.click(benIsChild);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save that change.");
    expect(benIsChild).not.toBeChecked();
  });

  it('keeps the app usable when the household cannot be loaded', async () => {
    logInWithHousehold();
    fakeHouseholdBackend.failLoading();
    renderAppAt('/household');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your household.");
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
