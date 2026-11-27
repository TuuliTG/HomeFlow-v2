import type * as newsApi from '@/features/news/api';
import type { NewsPerson, Reaction } from '@/features/news/news';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { isVisible, requestsFailing, type StoredTask, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/news/api`, installed for every unit test in `setup.ts`. Reads the done
 * tasks in `fakeTasksBackend` and keeps reactions and comments like `task_likes` and `task_comments`: only on
 * done shared tasks the user can see, one reaction each, none to one's own work, and only one's own to change.
 */
const likes: { taskId: string; userId: string; emoji: Reaction }[] = [];
const comments: {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}[] = [];
let commentsFail = false;

function person(userId: string | null): NewsPerson {
  return { userId, name: userId ? fakeAuthBackend.displayNameOf(userId) : null };
}

function isDoneShared(task: StoredTask): task is StoredTask & { completed: object } {
  return isVisible(task) && task.completed !== null && !task.isPrivate;
}

/** Runs `change` as the logged-in user on a done shared task they can see, failing like the database. */
function onDoneTask(taskId: string, change: (userId: string, task: StoredTask) => void) {
  const user = fakeAuthBackend.currentUser();
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (requestsFailing() || !user) return Promise.reject(new Error('Network error'));
  if (!task || !isDoneShared(task)) return Promise.reject(new Error('Row level security'));
  change(user.id, task);
  return Promise.resolve();
}

export const fakeNewsBackend = {
  reset() {
    likes.length = 0;
    comments.length = 0;
    commentsFail = false;
  },
  reactAs(userId: string, taskId: string, emoji: Reaction = '👍') {
    likes.push({ taskId, userId, emoji });
  },
  commentAs(userId: string, taskId: string, body: string) {
    comments.push({
      id: `comment:${String(comments.length)}`,
      taskId,
      authorId: userId,
      body,
      createdAt: new Date().toISOString(),
    });
  },
  /** Makes adding and deleting comments fail, like a network error. */
  failComments() {
    commentsFail = true;
  },
};

export const fetchNews: typeof newsApi.fetchNews = (since) => {
  if (requestsFailing() || !fakeAuthBackend.currentUser()) {
    return Promise.reject(new Error('Network error'));
  }
  return Promise.resolve(
    tasks
      .filter(isDoneShared)
      .filter((task) => task.points !== 0)
      .filter((task) => new Date(task.completed.at) >= since)
      .sort((a, b) => b.completed.at.localeCompare(a.completed.at))
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        type: task.type,
        icon: task.icon,
        points: task.points,
        completedAt: task.completed.at,
        doneBy: person(task.completed.by),
        helpers: task.helpers.map((helper) => ({
          person: person(helper.userId),
          points: helper.points,
        })),
        reactions: likes
          .filter((like) => like.taskId === task.id)
          .map((like) => ({ person: person(like.userId), emoji: like.emoji })),
        comments: comments
          .filter((comment) => comment.taskId === task.id)
          .map(({ id, authorId, body, createdAt }) => ({
            id,
            author: person(authorId),
            body,
            createdAt,
          })),
      })),
  );
};

export const reactToTask: typeof newsApi.reactToTask = (taskId, emoji) =>
  onDoneTask(taskId, (userId, task) => {
    if (task.completed?.by === userId) throw new Error('Row level security');
    const own = likes.find((like) => like.taskId === taskId && like.userId === userId);
    if (own) own.emoji = emoji;
    else likes.push({ taskId, userId, emoji });
  });

export const removeReaction: typeof newsApi.removeReaction = (taskId) =>
  onDoneTask(taskId, (userId) => {
    const index = likes.findIndex((like) => like.taskId === taskId && like.userId === userId);
    if (index >= 0) likes.splice(index, 1);
  });

export const addComment: typeof newsApi.addComment = (taskId, body) => {
  if (commentsFail) return Promise.reject(new Error('Network error'));
  return onDoneTask(taskId, (userId) => {
    fakeNewsBackend.commentAs(userId, taskId, body.trim());
  });
};

export const deleteComment: typeof newsApi.deleteComment = (commentId) => {
  if (commentsFail) return Promise.reject(new Error('Network error'));
  const user = fakeAuthBackend.currentUser();
  const index = comments.findIndex(
    (comment) => comment.id === commentId && comment.authorId === user?.id,
  );
  if (index >= 0) comments.splice(index, 1);
  return Promise.resolve();
};
