import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** Wednesday 8 October 2026, midday where the test runs. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

const priority = () => screen.getByRole('region', { name: 'Priority' });

function openTask(title: string) {
  return within(priority()).getByRole('button', { name: new RegExp(`^${title}`) });
}

describe('priority tasks on the board', () => {
  it('lists priority tasks at the top, whatever the filters, and the rest under their due dates', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Pay the daycare invoice',
      type: 'meta',
      points: 2,
      dueOn: '2026-10-05',
      isPriority: true,
    });
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Clean the oven',
      type: 'physical',
      points: 5,
      dueOn: '2026-10-05',
    });
    renderAppAt('/?show=undated&q=oven');

    await screen.findByRole('region', { name: 'Priority' });
    expect(openTask('Pay the daycare invoice')).toHaveTextContent('Was due Mon 5 Oct');
    expect(
      screen.queryByRole('listitem', { name: 'Pay the daycare invoice' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Clean the oven' })).not.toBeInTheDocument();
  });

  it('shows no Priority panel without priority tasks', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Clean the oven', type: 'physical', points: 5 });
    renderAppAt('/');

    await screen.findByRole('listitem', { name: 'Clean the oven' });
    expect(screen.queryByRole('region', { name: 'Priority' })).not.toBeInTheDocument();
  });

  it('opens a priority task to mark it done; a repeating one comes back as an ordinary task', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Pay the daycare invoice',
      type: 'meta',
      points: 2,
      repeatEveryDays: 30,
      dueOn: '2026-10-05',
      isPriority: true,
    });
    const user = userEvent.setup();
    renderAppAt('/');

    await screen.findByRole('region', { name: 'Priority' });
    await user.click(openTask('Pay the daycare invoice'));
    expect(openTask('Pay the daycare invoice')).toHaveAttribute('aria-expanded', 'true');
    await user.click(
      within(priority()).getByRole('button', { name: 'Mark done: Pay the daycare invoice' }),
    );

    await screen.findByRole('listitem', { name: 'Pay the daycare invoice' });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Priority' })).not.toBeInTheDocument();
    });
  });
});

describe('making a task a priority', () => {
  it('marks a new task a priority from the form', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Renew passports');
    await user.click(screen.getByRole('button', { name: 'Priority' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(
      await within(await screen.findByRole('region', { name: 'Priority' })).findByRole('button', {
        name: /^Renew passports/,
      }),
    ).toBeInTheDocument();
  });

  it('takes a task off the priority list when it is edited', async () => {
    const anna = logInAsFamilyMember();
    const id = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Renew passports',
      type: 'meta',
      points: 2,
      isPriority: true,
    });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${id}/edit`);

    const toggle = await screen.findByRole('button', { name: 'Priority' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByRole('listitem', { name: 'Renew passports' });
    expect(screen.queryByRole('region', { name: 'Priority' })).not.toBeInTheDocument();
  });

  it('offers no priority for a private task or a routine', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    expect(await screen.findByRole('button', { name: 'Priority' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Private' }));
    expect(screen.queryByRole('button', { name: 'Priority' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Private' }));
    await user.click(screen.getByRole('button', { name: 'Routine' }));
    expect(screen.queryByRole('button', { name: 'Priority' })).not.toBeInTheDocument();
  });
});
