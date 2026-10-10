import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { renderAppAt } from '@/test/renderWithRouter';

function logInAsAnna() {
  return fakeAuthBackend.logInAs('anna@example.com', 'Anna');
}

async function createHousehold(user: UserEvent, name: string) {
  await user.type(await screen.findByLabelText('Household name'), name);
  await user.click(screen.getByRole('button', { name: 'Create household' }));
}

async function joinHousehold(user: UserEvent, code: string) {
  await user.type(await screen.findByLabelText('Invite code'), code);
  await user.click(screen.getByRole('button', { name: 'Join household' }));
}

async function memberNames() {
  const members = await screen.findByRole('region', { name: 'Members' });
  const items = await within(members).findAllByRole('listitem');
  return items.map((item) => item.textContent);
}

describe('household setup', () => {
  it('sends a logged-in user without a household here from the app', async () => {
    logInAsAnna();
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up your household' }),
    ).toBeInTheDocument();
  });

  it("doesn't lock the user out of the app when their household can't be loaded", async () => {
    logInAsAnna();
    fakeHouseholdBackend.failLoading();
    renderAppAt('/');

    expect(await screen.findByText('Hello, Anna')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Shared tasks' })).toBeInTheDocument();
  });

  it('asks a logged-in user without a name for one first', async () => {
    fakeAuthBackend.logInAs('anna@example.com');
    renderAppAt('/');

    expect(await screen.findByLabelText('Your name')).toBeInTheDocument();
  });

  it('creates a household and shows its invite code and members', async () => {
    const user = userEvent.setup();
    logInAsAnna();
    renderAppAt('/household/setup');

    await createHousehold(user, '  The Virtanens ');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Virtanens' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ABCDEFGA')).toBeInTheDocument();
    expect(await memberNames()).toEqual(['Anna (you)']);
  });

  it('asks for a name instead of creating an unnamed household', async () => {
    const user = userEvent.setup();
    logInAsAnna();
    renderAppAt('/household/setup');

    await createHousehold(user, '   ');

    expect(screen.getByRole('alert')).toHaveTextContent('Give your household a name.');
    expect(screen.getByLabelText('Household name')).toHaveAccessibleDescription(
      'Give your household a name.',
    );
  });

  it('joins a household with an invite code typed loosely', async () => {
    const user = userEvent.setup();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    const { inviteCode } = fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    logInAsAnna();
    renderAppAt('/household/setup');

    await joinHousehold(user, ` ${inviteCode.slice(0, 4).toLowerCase()}-${inviteCode.slice(4)} `);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Virtanens' }),
    ).toBeInTheDocument();
    expect(await memberNames()).toEqual(['Ben', 'Anna (you)']);
  });

  it('explains when no household has the invite code', async () => {
    const user = userEvent.setup();
    logInAsAnna();
    renderAppAt('/household/setup');

    await joinHousehold(user, 'ZZZZ2222');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No household has this invite code. Check it with your family.',
    );
  });

  it('checks the invite code format before sending it', async () => {
    const user = userEvent.setup();
    logInAsAnna();
    renderAppAt('/household/setup');

    await joinHousehold(user, 'ABC');

    expect(screen.getByRole('alert')).toHaveTextContent('Enter the 8-character invite code.');
  });

  it.each([
    ['creating', (user: UserEvent) => createHousehold(user, 'The Virtanens'), "We couldn't create"],
    ['joining', (user: UserEvent) => joinHousehold(user, 'ABCDEFGA'), "We couldn't join"],
  ])('explains when %s fails', async (_action, submit, message) => {
    const user = userEvent.setup();
    logInAsAnna();
    fakeHouseholdBackend.failRequests();
    renderAppAt('/household/setup');

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it("doesn't offer the forms when it can't tell whether the user has a household", async () => {
    logInAsAnna();
    fakeHouseholdBackend.failLoading();
    renderAppAt('/household/setup');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't check whether you already have a household.",
    );
    expect(screen.queryByLabelText('Household name')).not.toBeInTheDocument();
  });

  it('sends a user who already has a household to it', async () => {
    const anna = logInAsAnna();
    fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
    renderAppAt('/household/setup');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'The Virtanens' }),
    ).toBeInTheDocument();
  });

  it('sends a logged-out visitor to log in', () => {
    renderAppAt('/household/setup');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
  });

  it('lets the user log out instead', async () => {
    const user = userEvent.setup();
    logInAsAnna();
    renderAppAt('/household/setup');

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Log in to HomeFlow' }),
    ).toBeInTheDocument();
  });
});
