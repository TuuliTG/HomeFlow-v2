const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Words and formats used across the app. */
export const common = {
  loading: 'Loading…',
  cancel: 'Cancel',
  save: 'Save',
  delete: 'Delete',
  yesDelete: 'Yes, delete',
  keepIt: 'Keep it',
  logOut: 'Log out',
  you: 'You',
  someone: 'Someone',
  newMember: 'New member (no name yet)',
  taskTypes: { physical: 'Physical', meta: 'Meta work' },
  /** "1 point", "3 points". */
  points: (count: number) => (count === 1 ? '1 point' : `${String(count)} points`),
  /** "Anna", "Anna and Ben", "Anna, Ben and Carl". */
  joinNames: (names: string[]) =>
    names.length <= 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`,
  /** "Helped by Ben (2 points)": who helped with a task and their shares, from `share`. */
  helpedBy: (shares: string[]) => `Helped by ${common.joinNames(shares)}`,
  /** "Ben (2 points)". */
  share: (name: string, count: number) => `${name} (${common.points(count)})`,
  today: 'Today',
  tomorrow: 'Tomorrow',
  yesterday: 'Yesterday',
  // Spelled out rather than Intl-formatted: browsers disagree on the punctuation ("Fri, 17 Oct").
  /** "Thu 8 Oct". */
  shortDate: (date: Date) =>
    `${weekdays[date.getDay()] ?? ''} ${String(date.getDate())} ${months[date.getMonth()] ?? ''}`,
  /** "8 Oct". */
  dayAndMonth: (date: Date) => `${String(date.getDate())} ${months[date.getMonth()] ?? ''}`,
  /** "9:05", "18:00". */
  time: (date: Date) => `${String(date.getHours())}:${String(date.getMinutes()).padStart(2, '0')}`,
};
