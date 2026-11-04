/**
 * The kinds of notification a member can turn off one by one (ADR 0005). They apply to all the
 * member's devices; each is a column of `notification_preferences`, which the Edge Functions read.
 */
export const notificationKinds = [
  'taskAdded',
  'taskCompleted',
  'taskLiked',
  'taskCommented',
  'taskRequested',
  'requestAnswered',
  'reminder',
] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export type NotificationPreferences = Record<NotificationKind, boolean>;

/** A member who never chose gets every kind. */
export const allNotifications: NotificationPreferences = {
  taskAdded: true,
  taskCompleted: true,
  taskLiked: true,
  taskCommented: true,
  taskRequested: true,
  requestAnswered: true,
  reminder: true,
};
