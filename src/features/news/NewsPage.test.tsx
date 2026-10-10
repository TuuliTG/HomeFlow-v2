import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeNewsBackend } from '@/test/fakeNewsApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

const DAY_MS = 24 * 60 * 60 * 1000;

function addBen() {
  const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
  fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
  return ben;
}

/** Adds a shared task as `userId` and marks it done as `doneBy`. */
function doTask(
  userId: string,
  doneBy: string,
  task: { title: string; type?: 'physical' | 'meta'; points?: number | null },
) {
  const id = `task:${String(fakeTasksBackend.taskCount())}`;
  fakeTasksBackend.addTaskAs(userId, {
    type: 'physical',
    points: 3,
    ...task,
    isPrivate: task.points === null,
  });
  fakeTasksBackend.completeTaskAs(doneBy, id, '2026-10-10');
  return id;
}

function day(name: string) {
  return screen.getByRole('region', { name });
}

function card(name: string) {
  return screen.getByRole('listitem', { name });
}

describe('news page', () => {
  it("shows what everyone did each day, with each member's points that day", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    doTask(anna.id, ben.id, { title: 'Wash the car', points: 4 });
    fakeTasksBackend.ageCompletions(DAY_MS);
    doTask(anna.id, ben.id, { title: 'Vacuum', points: 7 });
    doTask(anna.id, ben.id, { title: 'Book dentist', type: 'meta', points: 3 });
    doTask(ben.id, anna.id, { title: 'Water plants', points: 1 });
    renderAppAt('/news');

    const today = await screen.findByRole('region', { name: 'Today' });
    expect(
      within(within(today).getByRole('list', { name: 'Points earned' }))
        .getAllByRole('listitem')
        .map((summary) => summary.textContent),
    ).toEqual([
      'Ben earned 10 points: 7 physical, 3 meta work',
      'You earned 1 point of physical work',
    ]);
    expect(
      within(within(today).getByRole('list', { name: 'Tasks done' }))
        .getAllByRole('listitem', { name: /completed/ })
        .map((news) => news.getAttribute('aria-label')),
    ).toEqual(['You completed Water plants', 'Ben completed Book dentist', 'Ben completed Vacuum']);
    expect(card('Ben completed Book dentist')).toHaveTextContent('3 points · Meta work');
    expect(day('Yesterday')).toHaveTextContent('Ben earned 4 points of physical work');
    expect(
      within(day('Yesterday')).getByRole('listitem', { name: 'Ben completed Wash the car' }),
    ).toBeInTheDocument();
  });

  it('leaves out private tasks, open tasks and tasks done over a week ago', async () => {
    const anna = logInAsFamilyMember();
    addBen();
    doTask(anna.id, anna.id, { title: 'Wash the car' });
    fakeTasksBackend.ageCompletions(8 * DAY_MS);
    doTask(anna.id, anna.id, { title: 'Buy a present', points: null });
    fakeTasksBackend.addTaskAs(anna.id, { title: 'Vacuum', type: 'physical', points: 3 });
    renderAppAt('/news');

    expect(
      await screen.findByText(/No shared tasks done in the last week yet/),
    ).toBeInTheDocument();
  });

  it("gives a thumbs up to someone else's work and takes it back", async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    doTask(anna.id, ben.id, { title: 'Vacuum' });
    doTask(ben.id, anna.id, { title: 'Dust' });
    const user = userEvent.setup();
    renderAppAt('/news');

    const thumbsUp = await screen.findByRole('button', { name: 'Thumbs up: Vacuum' });
    expect(thumbsUp).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(card('You completed Dust')).queryByRole('button', { name: /Thumbs up/ }),
    ).not.toBeInTheDocument();

    await user.click(thumbsUp);
    expect(thumbsUp).toHaveAttribute('aria-pressed', 'true');
    expect(
      await within(card('Ben completed Vacuum')).findByText('You gave a thumbs up'),
    ).toBeInTheDocument();

    await user.click(thumbsUp);
    expect(thumbsUp).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => within(card('Ben completed Vacuum')).queryByText(/gave a thumbs up/))
      .toBeNull();
  });

  it('shows who gave a thumbs up to your work', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    const carl = fakeAuthBackend.addProfile('carl@example.com', 'Carl');
    fakeHouseholdBackend.addMember(carl.id, 'The Virtanens');
    const dust = doTask(ben.id, anna.id, { title: 'Dust' });
    fakeNewsBackend.likeAs(ben.id, dust);
    fakeNewsBackend.likeAs(carl.id, dust);
    renderAppAt('/news');

    expect(await screen.findByText('Ben and Carl gave a thumbs up')).toBeInTheDocument();
  });

  it('comments on a task and deletes only your own comments', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    const vacuum = doTask(anna.id, ben.id, { title: 'Vacuum' });
    fakeNewsBackend.commentAs(ben.id, vacuum, 'Took ages!');
    const user = userEvent.setup();
    renderAppAt('/news');

    await user.click(await screen.findByRole('button', { name: 'Comment on Vacuum' }));
    const field = screen.getByRole('textbox', { name: 'Comment on Vacuum' });
    expect(field).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write a comment first.');

    await user.type(field, '  Thank you, looks great!  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const comments = await within(card('Ben completed Vacuum')).findAllByRole('listitem');
    expect(comments.map((comment) => comment.textContent)).toEqual([
      'Ben Took ages!',
      'You Thank you, looks great!Delete',
    ]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Delete your comment: Thank you, looks great!' }),
    );
    await expect.poll(() => screen.queryByText('Thank you, looks great!')).toBeNull();
    expect(screen.getByText('Took ages!')).toBeInTheDocument();
  });

  it('says so when a comment cannot be sent, keeping what was written', async () => {
    const anna = logInAsFamilyMember();
    const ben = addBen();
    doTask(anna.id, ben.id, { title: 'Vacuum' });
    fakeNewsBackend.failComments();
    const user = userEvent.setup();
    renderAppAt('/news');

    await user.click(await screen.findByRole('button', { name: 'Comment on Vacuum' }));
    await user.type(screen.getByRole('textbox', { name: 'Comment on Vacuum' }), 'Thanks!');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't send your comment.");
    expect(screen.getByRole('textbox', { name: 'Comment on Vacuum' })).toHaveValue('Thanks!');
  });

  it('says so when the news cannot be loaded', async () => {
    logInAsFamilyMember();
    fakeTasksBackend.failRequests();
    renderAppAt('/news');

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load the news.");
  });

  it('is reached from the main navigation', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/');

    await user.click(
      within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'News',
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'What the family has done' }),
    ).toBeInTheDocument();
  });
});
