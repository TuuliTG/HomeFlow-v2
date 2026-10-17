/** "15 min", "1 h", "1 h 30 min". */
const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} min`;
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`;
};

/** Planning when to do your tasks, in a timetable on the Me page. */
export const schedule = {
  viewLegend: 'Show your tasks as',
  views: { list: 'List', day: 'Day', week: 'Week' },
  description: 'Plan when to do your tasks. Only you see your timetable.',
  timetable: 'Timetable',
  previousDay: 'Previous day',
  nextDay: 'Next day',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  /** "Mon 12 Oct – Sun 18 Oct". */
  range: (first: string, last: string) => `${first} – ${last}`,
  /** Names the list of blocks in one day's column. */
  plannedFor: (day: string) => `Planned for ${day}`,
  /** "Vacuum, 9:00–9:30": a block in the timetable, which opens its form. */
  block: (title: string, from: string, to: string) => `${title}, ${from}–${to}`,
  loadFailed: "We couldn't load your timetable. Check your connection and reload the page.",
  notScheduled: 'Not scheduled yet',
  dragHint: 'Drag a task into the timetable (on a phone, touch and hold it first) or use Schedule.',
  allScheduled: 'All your tasks are in the timetable.',
  schedule: 'Schedule',
  scheduleLabel: (title: string) => `Schedule: ${title}`,
  /** The form for one task's block. */
  formLabel: (title: string) => `When to do ${title}`,
  day: 'Day',
  start: 'Start',
  length: 'Length',
  duration,
  save: 'Save',
  remove: 'Remove from timetable',
  invalidStart: 'Choose a day and a start time.',
  tooFar: 'Choose a day within a year from today.',
  saveFailed: "We couldn't save this. Try again.",
  removeFailed: "We couldn't remove this from the timetable. Try again.",
  moveFailed: "We couldn't move the task. Try again.",
  /** Read out by screen readers while a task is dragged. */
  dragging: (title: string) => `Moving ${title}`,
  dropped: (title: string, day: string, time: string) => `${title} planned for ${day} at ${time}`,
  notMoved: (title: string) => `${title} was not moved`,
};
