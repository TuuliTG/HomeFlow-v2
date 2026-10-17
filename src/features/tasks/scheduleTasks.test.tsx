import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { atMinutes, startOfWeek } from '@/features/tasks/schedule';
import { addDays, fromIsoDate, today } from '@/lib/dates';
import { en } from '@/locales/en';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { fakeHouseholdBackend } from '@/test/fakeHouseholdApi';
import { fakeSchedulesBackend } from '@/test/fakeSchedulesApi';
import { fakeTasksBackend } from '@/test/fakeTasksBackend';
import { renderAppAt } from '@/test/renderWithRouter';
import { logInAsFamilyMember } from '@/test/session';

/** The name of a day's column: "Planned for Sat 17 Oct". */
const plannedFor = (isoDate: string) =>
  en.schedule.plannedFor(en.common.shortDate(fromIsoDate(isoDate)));

function addPrivateTask(userId: string, title: string): string {
  return fakeTasksBackend.addTaskAs(userId, { title, type: 'meta', points: null, isPrivate: true });
}

/** Schedules the task on `day` from `start` ("9:00") for `minutes`. */
function scheduleAt(
  userId: string,
  taskId: string,
  { day, start, minutes = 30 }: { day: string; start: string; minutes?: number },
) {
  const [hours = 0, mins = 0] = start.split(':').map(Number);
  fakeSchedulesBackend.scheduleAs(userId, {
    taskId,
    startsAt: atMinutes(day, hours * 60 + mins).toISOString(),
    durationMinutes: minutes,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('scheduling tasks', () => {
  it('shows your tasks in a timetable of the week', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    addPrivateTask(anna.id, 'Call grandma');
    scheduleAt(anna.id, present, { day: today(), start: '9:00', minutes: 45 });
    const user = userEvent.setup();
    const { router } = renderAppAt('/me');

    await user.click(await screen.findByRole('radio', { name: 'Week' }));

    expect(router.state.location.search).toBe('?view=week');
    const day = await screen.findByRole('list', { name: plannedFor(today()) });
    expect(
      within(day).getByRole('button', { name: 'Buy a present, 9:00–9:45' }),
    ).toBeInTheDocument();
    for (let index = 0; index < 7; index++) {
      const date = addDays(startOfWeek(today()), index);
      expect(screen.getByRole('list', { name: plannedFor(date) })).toBeInTheDocument();
    }
    const notScheduled = screen.getByRole('region', { name: 'Not scheduled yet' });
    expect(
      within(notScheduled).getByRole('listitem', { name: 'Call grandma' }),
    ).toBeInTheDocument();
    expect(within(notScheduled).queryByText('Buy a present')).not.toBeInTheDocument();
  });

  it('leaves out tasks that are not yours to do', async () => {
    const anna = logInAsFamilyMember();
    const ben = fakeAuthBackend.addProfile('ben@example.com', 'Ben');
    fakeHouseholdBackend.addMember(ben.id, 'The Virtanens');
    const vacuum = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Vacuum',
      type: 'physical',
      points: 3,
    });
    fakeTasksBackend.pickUpTaskAs(ben.id, vacuum);
    addPrivateTask(anna.id, 'Buy a present');
    renderAppAt('/me?view=day');

    await screen.findByRole('listitem', { name: 'Buy a present' });
    expect(screen.queryByText('Vacuum')).not.toBeInTheDocument();
  });

  it('schedules a task with its form', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    const tomorrow = addDays(today(), 1);
    const user = userEvent.setup();
    renderAppAt('/me?view=day');

    const scheduleButton = await screen.findByRole('button', { name: 'Schedule: Buy a present' });
    await user.click(scheduleButton);
    const form = screen.getByRole('form', { name: 'When to do Buy a present' });
    const day = within(form).getByLabelText('Day');
    expect(day).toHaveFocus();
    expect(day).toHaveValue(today());
    fireEvent.change(day, { target: { value: tomorrow } });
    fireEvent.change(within(form).getByLabelText('Start'), { target: { value: '18:15' } });
    await user.selectOptions(within(form).getByLabelText('Length'), '1 h');
    await user.click(within(form).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });
    expect(fakeSchedulesBackend.scheduleOf(anna.id, present)).toEqual({
      taskId: present,
      startsAt: atMinutes(tomorrow, 18 * 60 + 15).toISOString(),
      durationMinutes: 60,
    });
    expect(screen.getByText('All your tasks are in the timetable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next day' }));
    expect(
      within(screen.getByRole('list', { name: plannedFor(tomorrow) })).getByRole('button', {
        name: 'Buy a present, 18:15–19:15',
      }),
    ).toBeInTheDocument();
  });

  it('asks for a start time', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me?view=day');

    await user.click(await screen.findByRole('button', { name: 'Schedule: Buy a present' }));
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a day and a start time.');
    expect(fakeSchedulesBackend.scheduleOf(anna.id, present)).toBeNull();
  });

  it('moves a block with its form, and takes it off the timetable', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    scheduleAt(anna.id, present, { day: today(), start: '9:00', minutes: 50 });
    const user = userEvent.setup();
    renderAppAt('/me?view=day');

    await user.click(await screen.findByRole('button', { name: 'Buy a present, 9:00–9:50' }));
    // A length that isn't offered stays as it is.
    expect(screen.getByLabelText('Length')).toHaveDisplayValue('50 min');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:30' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const moved = await screen.findByRole('button', { name: 'Buy a present, 10:30–11:20' });
    await waitFor(() => {
      expect(moved).toHaveFocus();
    });
    await user.click(moved);
    await user.click(screen.getByRole('button', { name: 'Remove from timetable' }));

    expect(
      await screen.findByRole('button', { name: 'Schedule: Buy a present' }),
    ).toBeInTheDocument();
    expect(fakeSchedulesBackend.scheduleOf(anna.id, present)).toBeNull();
  });

  it('goes back and forth a week at a time', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me?view=week');

    const monday = startOfWeek(today());
    const range = (first: string) =>
      en.schedule.range(
        en.common.shortDate(fromIsoDate(first)),
        en.common.shortDate(fromIsoDate(addDays(first, 6))),
      );
    expect(await screen.findByText(range(monday))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(screen.getByText(range(addDays(monday, 7)))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(screen.getByText(range(addDays(monday, -7)))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByText(range(monday))).toBeInTheDocument();
  });

  it('says when the timetable cannot be loaded', async () => {
    const anna = logInAsFamilyMember();
    addPrivateTask(anna.id, 'Buy a present');
    const user = userEvent.setup();
    renderAppAt('/me');

    await screen.findByRole('listitem', { name: 'Buy a present' });
    fakeTasksBackend.failRequests();
    await user.click(screen.getByRole('radio', { name: 'Day' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your timetable.");
  });

  it('is cleared when you put a task back', async () => {
    const anna = logInAsFamilyMember();
    const vacuum = fakeTasksBackend.addTaskAs(anna.id, {
      title: 'Vacuum',
      type: 'physical',
      points: 3,
    });
    fakeTasksBackend.pickUpTaskAs(anna.id, vacuum);
    scheduleAt(anna.id, vacuum, { day: today(), start: '9:00' });
    const user = userEvent.setup();
    renderAppAt('/');

    const task = await screen.findByRole('listitem', { name: 'Vacuum' });
    await user.click(within(task).getByRole('button', { name: 'Put back: Vacuum' }));

    await within(task).findByRole('button', { name: 'Pick up: Vacuum' });
    expect(fakeSchedulesBackend.scheduleOf(anna.id, vacuum)).toBeNull();
  });
});

describe('dragging tasks in the timetable', () => {
  /** Lays out the day's column 100px down the page, an hour 60px tall, in a scrolling box 2000px tall. */
  function layOut(day: string) {
    const column = screen.getByRole('list', { name: plannedFor(day) }).parentElement;
    const rects = new Map<Element | null | undefined, DOMRect>([
      [column?.closest('.overflow-y-auto'), new DOMRect(0, 0, 400, 2000)],
      [column, new DOMRect(50, 100, 300, 1440)],
    ]);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      return rects.get(this) ?? new DOMRect();
    });
  }

  function drag(element: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
    fireEvent.mouseDown(element, { button: 0, clientX: from.x, clientY: from.y });
    fireEvent.mouseMove(document, { clientX: from.x, clientY: from.y + 10 });
    fireEvent.mouseMove(document, { clientX: to.x, clientY: to.y });
    fireEvent.mouseUp(document, { clientX: to.x, clientY: to.y });
  }

  it('moves a block to where it is dropped, in steps of a quarter of an hour', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    scheduleAt(anna.id, present, { day: today(), start: '9:00' });
    renderAppAt('/me?view=day');
    const block = await screen.findByRole('button', { name: 'Buy a present, 9:00–9:30' });
    layOut(today());

    // 9:00 is 640px down: grabbed 10px below its top and dropped 65 minutes lower.
    drag(block, { x: 100, y: 650 }, { x: 100, y: 715 });

    expect(
      await screen.findByRole('button', { name: 'Buy a present, 10:00–10:30' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(fakeSchedulesBackend.scheduleOf(anna.id, present)?.startsAt).toBe(
        atMinutes(today(), 10 * 60).toISOString(),
      );
    });
    expect(screen.getByText('Buy a present planned for', { exact: false })).toBeInTheDocument();
  });

  it('schedules a task dragged into the timetable', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    renderAppAt('/me?view=day');
    const item = await screen.findByRole('listitem', { name: 'Buy a present' });
    layOut(today());

    drag(item, { x: 100, y: 1600 }, { x: 120, y: 100 + 14 * 60 + 5 });

    await waitFor(() => {
      expect(fakeSchedulesBackend.scheduleOf(anna.id, present)).toEqual({
        taskId: present,
        startsAt: atMinutes(today(), 14 * 60).toISOString(),
        durationMinutes: 30,
      });
    });
  });

  it('leaves a task where it was when dropped outside the timetable', async () => {
    const anna = logInAsFamilyMember();
    const present = addPrivateTask(anna.id, 'Buy a present');
    renderAppAt('/me?view=day');
    const item = await screen.findByRole('listitem', { name: 'Buy a present' });
    layOut(today());

    drag(item, { x: 100, y: 1600 }, { x: 100, y: 2100 });

    expect(await screen.findByText('Buy a present was not moved')).toBeInTheDocument();
    expect(fakeSchedulesBackend.scheduleOf(anna.id, present)).toBeNull();
  });
});
