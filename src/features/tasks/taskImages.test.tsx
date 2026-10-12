import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeImagesBackend, setTaskImages, uploadTaskImage } from '@/test/fakeImagesApi';
import { fakeTasksBackend, tasks } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

// jsdom can't decode pictures; a file named *.heic stands for one the browser can't read.
vi.mock('@/features/tasks/shrinkImage', () => ({
  shrinkImage: (file: File) =>
    file.name.endsWith('.heic')
      ? Promise.reject(new Error('Not a picture'))
      : Promise.resolve(new Blob([file.name], { type: 'image/jpeg' })),
}));

function photo(name: string) {
  return new File(['photo'], name, { type: 'image/jpeg' });
}

/** The household's folder in the fake storage. */
const folder = 'household:The Virtanens';

/** Adds a task as the logged-in user with `count` pictures, picture-1.jpg onwards. */
async function addTaskWithImages(
  userId: string,
  { count, repeatEveryDays = null }: { count: number; repeatEveryDays?: number | null },
) {
  const taskId = fakeTasksBackend.addTaskAs(userId, {
    title: 'Water the plants',
    type: 'physical',
    points: 3,
    repeatEveryDays,
  });
  const paths: string[] = [];
  for (let index = 0; index < count; index += 1) {
    paths.push(await uploadTaskImage(folder, new Blob()));
  }
  await setTaskImages(taskId, paths);
  return taskId;
}

describe('pictures on tasks', () => {
  it('attaches pictures to a new task and shows them on its card', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.type(await screen.findByLabelText('Task'), 'Water the plants');
    await user.upload(screen.getByLabelText('Add a picture'), [
      photo('balcony.jpg'),
      photo('hall.jpg'),
    ]);
    expect(await screen.findByRole('img', { name: 'Picture 2' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    const pictures = await within(task).findAllByRole('link', {
      name: /^Picture \d of Water the plants \(opens in a new tab\)$/,
    });
    expect(pictures).toHaveLength(2);
    expect(pictures[0]).toHaveAttribute('href', `https://images.test/${folder}/picture-1.jpg`);
    expect(pictures[0]).toHaveAttribute('target', '_blank');
  });

  it('lets another member see the pictures of a shared task', async () => {
    const anna = logInAsFamilyMember();
    await addTaskWithImages(anna.id, { count: 1 });
    const ben = fakeAuthBackend.logInAs('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(
      await within(task).findByRole('img', {
        name: 'Picture 1 of Water the plants (opens in a new tab)',
      }),
    ).toHaveAttribute('src', `https://images.test/${folder}/picture-1.jpg`);
  });

  it("says when the pictures can't be loaded", async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 1 });
    fakeImagesBackend.failImageRequests();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(await within(task).findByText("We couldn't load the pictures.")).toBeInTheDocument();

    renderAppAt(`/tasks/${taskId}/edit`);
    expect(
      await screen.findByRole('img', { name: "We couldn't load this picture." }),
    ).toBeInTheDocument();
  });

  it('removes and adds pictures when editing, deleting the files no task shows', async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 2 });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${taskId}/edit`);

    expect(await screen.findByRole('img', { name: 'Picture 2' })).toHaveAttribute(
      'src',
      `https://images.test/${folder}/picture-2.jpg`,
    );
    await user.click(screen.getByRole('button', { name: 'Remove picture 1' }));
    await user.upload(screen.getByLabelText('Add a picture'), photo('kitchen.jpg'));
    await screen.findByRole('img', { name: 'Picture 2' });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    const pictures = await within(task).findAllByRole('img', {
      name: /of Water the plants \(opens in a new tab\)$/,
    });
    expect(pictures.map((picture) => picture.getAttribute('src'))).toEqual([
      `https://images.test/${folder}/picture-2.jpg`,
      `https://images.test/${folder}/picture-3.jpg`,
    ]);
    expect(fakeImagesBackend.files()).not.toContain(`${folder}/picture-1.jpg`);
  });

  it("deletes the new pictures' files when the task can't be saved", async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 0 });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${taskId}/edit`);
    await user.upload(await screen.findByLabelText('Add a picture'), photo('kitchen.jpg'));
    await screen.findByRole('img', { name: 'Picture 1' });
    // Someone else marks it done meanwhile, so it can't be edited any more; the board hasn't heard yet.
    const stored = tasks.find((task) => task.id === taskId);
    if (stored) stored.completed = { by: anna.id, at: new Date().toISOString() };

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the task.");
    expect(fakeImagesBackend.files()).toEqual([]);
  });

  it('keeps pictures someone else added while the form was open', async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 1 });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${taskId}/edit`);
    await screen.findByRole('img', { name: 'Picture 1' });
    const added = await uploadTaskImage(folder, new Blob());
    await setTaskImages(taskId, [`${folder}/picture-1.jpg`, added]);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const task = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(await within(task).findAllByRole('img', { name: /of Water the plants/ })).toHaveLength(
      2,
    );
    expect(fakeImagesBackend.files()).toContain(added);
  });

  it('takes at most three pictures', async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.upload(await screen.findByLabelText('Add a picture'), [
      photo('1.jpg'),
      photo('2.jpg'),
      photo('3.jpg'),
      photo('4.jpg'),
    ]);

    expect(await screen.findByRole('img', { name: 'Picture 3' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Picture 4' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('A task can have up to 3 pictures.');
    expect(screen.queryByLabelText('Add a picture')).not.toBeInTheDocument();
  });

  it("explains when a picture can't be read", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');

    await user.upload(await screen.findByLabelText('Add a picture'), photo('photo.heic'));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read that picture.");
    expect(screen.queryByRole('img', { name: 'Picture 1' })).not.toBeInTheDocument();
  });

  it("adds nothing when the pictures can't be uploaded", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');
    await user.type(await screen.findByLabelText('Task'), 'Water the plants');
    await user.upload(screen.getByLabelText('Add a picture'), photo('balcony.jpg'));
    await screen.findByRole('img', { name: 'Picture 1' });
    fakeImagesBackend.failImageRequests();

    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't save the task.");
    expect(fakeTasksBackend.taskCount()).toBe(0);
  });

  it("opens the new task for editing when its pictures can't be attached", async () => {
    logInAsFamilyMember();
    const user = userEvent.setup();
    renderAppAt('/tasks/new');
    await user.type(await screen.findByLabelText('Task'), 'Water the plants');
    await user.upload(screen.getByLabelText('Add a picture'), photo('balcony.jpg'));
    await screen.findByRole('img', { name: 'Picture 1' });
    fakeImagesBackend.failSettingImages();

    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Edit task' })).toBeInTheDocument();
    expect(
      screen.getByText('The task was added, but not its pictures. Add them again here.'),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Task')).toHaveValue('Water the plants');
    expect(fakeImagesBackend.files()).toEqual([]);
  });

  it('keeps the pictures on the next occurrence of a repeating task', async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 1, repeatEveryDays: 7 });
    fakeTasksBackend.completeTaskAs(anna.id, taskId, '2026-10-12');
    renderAppAt('/');

    const next = await screen.findByRole('listitem', { name: 'Water the plants' });
    expect(
      await within(next).findByRole('img', {
        name: 'Picture 1 of Water the plants (opens in a new tab)',
      }),
    ).toBeInTheDocument();
  });

  it('deletes the files of a deleted task', async () => {
    const anna = logInAsFamilyMember();
    const taskId = await addTaskWithImages(anna.id, { count: 1 });
    const user = userEvent.setup();
    renderAppAt(`/tasks/${taskId}/edit`);

    await user.click(await screen.findByRole('button', { name: 'Delete task' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));

    await screen.findByRole('heading', { level: 1, name: 'Shared tasks' });
    expect(fakeImagesBackend.files()).toEqual([]);
  });
});
