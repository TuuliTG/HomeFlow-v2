import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const HINT = 'Not counted in statistics.';

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

describe('shared tasks without points', () => {
  it('can be added with 0 points, saying they are not counted, and show no points', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Dentist on Thursday');
    const points = screen.getByLabelText('Points');
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    await user.clear(points);
    await user.type(points, '0');
    expect(points).toHaveAccessibleDescription(HINT);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Dentist on Thursday' });
    expect(task).not.toHaveTextContent('point');
  });

  it('count for nobody in statistics, done or created', async () => {
    const anna = logInAsFamilyMember();
    addBen();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dentist on Thursday', type: 'meta', points: 0 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-09');
    renderAppAt('/statistics');

    const created = await screen.findByRole('region', { name: 'Tasks created' });
    expect(within(created).getAllByRole('listitem')[0]).toHaveTextContent('0 tasks');
    expect(screen.getByRole('region', { name: 'Points earned' })).toHaveTextContent(
      'No points earned yet in this period.',
    );
  });

  it("aren't news and don't ask who helped", async () => {
    const anna = logInAsFamilyMember();
    addBen();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Dentist on Thursday', type: 'meta', points: 0 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-11');
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Laundry', type: 'physical', points: 3 });
    fakeTasksBackend.completeTaskAs(anna.id, 'task:1', '2026-10-11');
    const { router } = renderAppAt('/me');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    const done = (await within(completed).findByText('Dentist on Thursday')).closest('li');
    expect(done).not.toHaveTextContent('point');
    expect(
      screen.queryByRole('link', { name: 'Who helped with Dentist on Thursday?' }),
    ).not.toBeInTheDocument();

    await router.navigate('/news');
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(within(today).getByText('Laundry')).toBeInTheDocument();
    expect(within(today).queryByText('Dentist on Thursday')).not.toBeInTheDocument();
  });
});
