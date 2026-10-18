import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeRequestsBackend } from '@/test/fakeRequestsApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

function addMember(email: string, name: string, isChild = false) {
  const member = fakeAuthBackend.addProfile(email, name);
  fakeHouseholdBackend.addMember(member.id, 'The Virtanens');
  fakeHouseholdBackend.setChild(member.id, isChild);
  return member;
}

function addTask(userId: string, title: string, forChildren = false) {
  return fakeTasksBackend.addTaskAs(userId, { title, type: 'physical', points: 3, forChildren });
}

describe('asking a family member to do a task', () => {
  it('asks another member from the board, and shows the request on the card', async () => {
    const anna = logInAsFamilyMember();
    addMember('ben@example.com', 'Ben');
    addTask(anna.id, 'Vacuum');
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(await screen.findByRole('link', { name: 'Ask someone to do Vacuum' }));
    expect(await screen.findByRole('heading', { name: 'Ask someone' })).toBeInTheDocument();
    const who = screen.getByRole('group', { name: 'Who to ask' });
    expect(within(who).queryByRole('radio', { name: 'Anna' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
    await user.click(within(who).getByRole('radio', { name: 'Ben' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('You asked Ben to do this.')).toBeInTheDocument();
    expect(within(task).queryByRole('link', { name: /^Ask someone/ })).not.toBeInTheDocument();
  });

  it.each([
    ['only adults for an adults-only task', false, ['Ben']],
    ['children too for a task for children', true, ['Ben', 'Carol']],
  ])('offers %s', async (_case, forChildren, names) => {
    const anna = logInAsFamilyMember();
    addMember('ben@example.com', 'Ben');
    addMember('carol@example.com', 'Carol', true);
    const taskId = addTask(anna.id, 'Feed the cat', forChildren);
    renderAppAt(`/tasks/${taskId}/ask`);

    const who = await screen.findByRole('group', { name: 'Who to ask' });
    expect(
      within(who)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(names);
  });

  it('lets the member asked accept from their Me page, which picks the task up for them', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeTasksBackend.addTaskAs(ben.id, { title: 'Dust', type: 'physical', points: 1 });
    fakeAuthBackend.logInAs('ben@example.com');
    fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    const user = userEvent.setup();
    renderAppAt('/me');

    const asked = await screen.findByRole('region', { name: 'Asked of you' });
    const task = within(asked).getByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Anna asked you to do this.')).toBeInTheDocument();
    await user.click(within(task).getByRole('button', { name: 'Accept: Vacuum' }));

    const toDo = screen.getByRole('region', { name: 'To do' });
    const accepted = await within(toDo).findByRole('listitem', { name: 'Vacuum' });
    expect(within(accepted).getByText('Picked up by you')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Asked of you' })).not.toBeInTheDocument();
  });

  it('tells whoever asked that the member declined, until they dismiss it', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    fakeRequestsBackend.answerRequestAs(ben.id, vacuum, false);
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText("Ben can't do this.")).toBeInTheDocument();
    expect(
      within(task).getByRole('link', { name: 'Ask someone to do Vacuum' }),
    ).toBeInTheDocument();
    await user.click(within(task).getByRole('button', { name: 'OK, dismiss: Vacuum' }));

    expect(
      await within(task).findByRole('button', { name: 'Pick up: Vacuum' }),
    ).toBeInTheDocument();
    expect(within(task).queryByText("Ben can't do this.")).not.toBeInTheDocument();
  });

  it('lets the member asked decline, leaving the task free', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeAuthBackend.logInAs('ben@example.com');
    fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    await user.click(within(task).getByRole('button', { name: 'Decline: Vacuum' }));

    expect(
      await within(task).findByRole('button', { name: 'Pick up: Vacuum' }),
    ).toBeInTheDocument();
    expect(within(task).queryByText(/asked/)).not.toBeInTheDocument();
  });

  it('lets whoever asked cancel the request', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    await user.click(within(task).getByRole('button', { name: 'Cancel request: Vacuum' }));

    expect(
      await within(task).findByRole('link', { name: 'Ask someone to do Vacuum' }),
    ).toBeInTheDocument();
    expect(within(task).queryByText(/asked/)).not.toBeInTheDocument();
  });

  it('shows the rest of the household who was asked', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const carol = addMember('carol@example.com', 'Carol');
    logInAsFamilyMember();
    const vacuum = addTask(carol.id, 'Vacuum');
    fakeRequestsBackend.requestTaskAs(carol.id, vacuum, ben.id);
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    expect(within(task).getByText('Carol asked Ben to do this.')).toBeInTheDocument();
    expect(
      within(task).queryByRole('button', { name: /^(Accept|Decline|Cancel request)/ }),
    ).toBeNull();
  });

  it('shows a request as it arrives', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeAuthBackend.logInAs('ben@example.com');
    renderAppAt('/me');
    await screen.findByRole('region', { name: 'To do' });

    act(() => {
      fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    });

    const asked = await screen.findByRole('region', { name: 'Asked of you' });
    expect(within(asked).getByRole('listitem', { name: 'Vacuum' })).toBeInTheDocument();
  });

  it('offers no Ask when nobody else could do the task or someone else has it', async () => {
    const anna = logInAsFamilyMember();
    addTask(anna.id, 'Vacuum');
    const ben = addMember('ben@example.com', 'Ben', true);
    const dust = addTask(anna.id, 'Dust', true);
    fakeTasksBackend.pickUpTaskAs(ben.id, dust);
    renderAppAt('/');

    const vacuum = await screen.findByRole('listitem', { name: 'Vacuum' });
    const dusting = screen.getByRole('listitem', { name: 'Dust' });
    // Ben is a child, so only tasks for children could be asked of him; he has picked up the one there is.
    expect(within(vacuum).queryByRole('link', { name: /^Ask someone/ })).not.toBeInTheDocument();
    expect(within(dusting).queryByRole('link', { name: /^Ask someone/ })).not.toBeInTheDocument();
  });

  it('explains when an answer cannot be saved', async () => {
    const ben = addMember('ben@example.com', 'Ben');
    const anna = logInAsFamilyMember();
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeAuthBackend.logInAs('ben@example.com');
    fakeRequestsBackend.requestTaskAs(anna.id, vacuum, ben.id);
    const user = userEvent.setup();
    renderAppAt('/');
    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    fakeTasksBackend.failRequests();

    await user.click(within(task).getByRole('button', { name: 'Accept: Vacuum' }));

    expect(await within(task).findByRole('alert')).toHaveTextContent(
      "We couldn't save your answer. The task may be done or taken already.",
    );
  });

  it('explains when a task can no longer be asked of anyone', async () => {
    const anna = logInAsFamilyMember();
    const ben = addMember('ben@example.com', 'Ben');
    const vacuum = addTask(anna.id, 'Vacuum');
    fakeTasksBackend.pickUpTaskAs(ben.id, vacuum);
    renderAppAt(`/tasks/${vacuum}/ask`);

    expect(
      await screen.findByText(/This task can no longer be asked of anyone/),
    ).toBeInTheDocument();
  });
});
