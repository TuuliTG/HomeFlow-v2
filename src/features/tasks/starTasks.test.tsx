import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const TRASH = { title: 'Take out trash', type: 'physical', points: 1 } as const;

describe('starring tasks from the task lists', () => {
  it('stars an open task on the board and offers it on the New task form', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Take out trash' });
    const star = await within(task).findByRole('button', { name: 'Favourite: Take out trash' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await user.click(star);

    expect(star).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(fakeTasksBackend.favouritesOf(anna.id)).toEqual(['take out trash']);
    });
    await user.click(screen.getByRole('link', { name: 'New task' }));
    const favourites = await screen.findByRole('region', { name: 'Favourites' });
    expect(await within(favourites).findByRole('button', { name: /Take out trash/ })).toBeVisible();
  });

  it('shows which tasks are favourites already and unstars one', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.setFavouriteAs(anna.id, 'TAKE OUT TRASH', true);
    const user = userEvent.setup();
    renderAppAt('/');

    const star = await screen.findByRole('button', { name: 'Favourite: Take out trash' });
    await waitFor(() => {
      expect(star).toHaveAttribute('aria-pressed', 'true');
    });
    await user.click(star);

    expect(star).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => {
      expect(fakeTasksBackend.favouritesOf(anna.id)).toEqual([]);
    });
  });

  it("stars a task from the household's completed tasks", async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/?completed=1');

    const completed = await screen.findByRole('region', { name: 'Completed' });
    await user.click(
      await within(completed).findByRole('button', { name: 'Favourite: Take out trash' }),
    );

    await waitFor(() => {
      expect(fakeTasksBackend.favouritesOf(anna.id)).toEqual(['take out trash']);
    });
  });

  it('stars a task from the completed tasks on the Me page', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    fakeTasksBackend.completeTaskAs(anna.id, 'task:0', '2026-10-08');
    const user = userEvent.setup();
    renderAppAt('/me');

    const completed = await screen.findByRole('list', { name: 'Completed tasks' });
    await user.click(
      await within(completed).findByRole('button', { name: 'Favourite: Take out trash' }),
    );

    await waitFor(() => {
      expect(fakeTasksBackend.favouritesOf(anna.id)).toEqual(['take out trash']);
    });
  });

  it('takes the star back when saving it fails', async () => {
    const anna = logInAsFamilyMember();
    fakeTasksBackend.addTaskAs(anna.id, TRASH);
    const user = userEvent.setup();
    renderAppAt('/');
    const star = await screen.findByRole('button', { name: 'Favourite: Take out trash' });
    await waitFor(() => {
      expect(star).toBeEnabled();
    });
    fakeTasksBackend.failRequests();

    await user.click(star);

    await waitFor(() => {
      expect(star).toHaveAttribute('aria-pressed', 'false');
    });
    expect(fakeTasksBackend.favouritesOf(anna.id)).toEqual([]);
  });
});
