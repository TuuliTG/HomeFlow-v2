import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';

/**
 * Anna, an adult, adds tasks for children and one for adults only; Mia, a child, has picked one up; Ben, also
 * a child, logs in.
 */
function logInAsChild() {
  const anna = fakeAuthBackend.addProfile('anna@example.com', 'Anna');
  fakeHouseholdBackend.addMember(anna.id, 'The Virtanens');
  const mia = fakeAuthBackend.addProfile('mia@example.com', 'Mia');
  fakeHouseholdBackend.addMember(mia.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(mia.id, true);
  const forChildren = { type: 'physical', points: 2, forChildren: true } as const;
  fakeTasksBackend.addTaskAs(anna.id, { title: 'Feed the cat', icon: 'pet', ...forChildren });
  const plants = fakeTasksBackend.addTaskAs(anna.id, { title: 'Water the plants', ...forChildren });
  fakeTasksBackend.pickUpTaskAs(mia.id, plants);
  fakeTasksBackend.addTaskAs(anna.id, { title: 'Pay the bills', type: 'meta', points: 3 });
  const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(ben.id, true);
  return ben;
}

describe('the Shared tasks screen for children', () => {
  it('shows the tasks for children as big tiles: free ones to pick, and who is doing the others', async () => {
    logInAsChild();
    renderAppAt('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tasks for you' }),
    ).toBeInTheDocument();
    const free = await screen.findByRole('list', { name: 'Free to pick' });
    const cat = within(free).getByRole('listitem', { name: 'Feed the cat' });
    expect(within(cat).getByRole('img', { name: '2 points' })).toBeInTheDocument();
    const others = screen.getByRole('list', { name: 'Others are doing' });
    const plants = within(others).getByRole('listitem', { name: 'Water the plants' });
    expect(within(plants).getByText('Mia is doing it')).toBeInTheDocument();
    expect(within(plants).queryByRole('button')).not.toBeInTheDocument();

    expect(screen.queryByText('Pay the bills')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Show' })).not.toBeInTheDocument();
  });

  it('lets them pick up a task and mark it done there', async () => {
    logInAsChild();
    const user = userEvent.setup();
    renderAppAt('/');

    const free = await screen.findByRole('list', { name: 'Free to pick' });
    await user.click(within(free).getByRole('button', { name: 'Pick up: Feed the cat' }));

    const yours = await screen.findByRole('list', { name: 'Your tasks' });
    await user.click(within(yours).getByRole('button', { name: 'Mark done: Feed the cat' }));

    expect(await screen.findByText('No free tasks right now.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your tasks' })).not.toBeInTheDocument();
  });
});
