import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';

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

    expect(await screen.findByRole('status')).toHaveTextContent('Copied');
    await expect(navigator.clipboard.readText()).resolves.toBe(inviteCode);
  });

  it('says so when the code cannot be copied', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Not allowed'));
    logInWithHousehold();
    renderAppAt('/household');

    await user.click(await screen.findByRole('button', { name: 'Copy code' }));

    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't copy.");
  });

  it('lists members who have not chosen a name yet', async () => {
    const { name } = logInWithHousehold();
    fakeHouseholdBackend.addMember('user:ben@example.com', name);
    renderAppAt('/household');

    expect(await screen.findByText('New member (no name yet)')).toBeInTheDocument();
  });

  it('asks a logged-out visitor to log in', () => {
    renderAppAt('/household');

    const prompt = screen.getByText(/to create or join your family's household/);
    expect(within(prompt).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
