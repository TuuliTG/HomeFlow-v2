import type * as newsApi from '@/features/news/api';
import type { NewsPerson } from '@/features/news/news';
import { fakeAuthBackend } from '@/test/fakeAuthApi';
import { isVisible, requestsFailing, type StoredTask, tasks } from '@/test/fakeTasksBackend';

/**
 * In-memory stand-in for `@/features/news/api`, installed for every unit test in `setup.ts`. Reads the done
 * tasks in `fakeTasksBackend` and keeps likes and comments like `task_likes` and `task_comments`: only on done
 * shared tasks the user can see, no thumbs up for one's own work, and only one's own to take back.
 */
const likes: { taskId: string; userId: string }[] = [];
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
  likeAs(userId: string, taskId: string) {
    likes.push({ taskId, userId });
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
  /** Makes adding comments fail, like a network error. */
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
      .filter((task) => new Date(task.completed.at) >= since)
      .sort((a, b) => b.completed.at.localeCompare(a.completed.at))
      .map((task) => ({
        taskId: task.id,
        title: task.title,
        type: task.type,
        points: task.points ?? 0,
        completedAt: task.completed.at,
        doneBy: person(task.completed.by),
        likedBy: likes.filter((like) => like.taskId === task.id).map((like) => person(like.userId)),
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

export const likeTask: typeof newsApi.likeTask = (taskId) =>
  onDoneTask(taskId, (userId, task) => {
    if (task.completed?.by === userId) throw new Error('Row level security');
    if (!likes.some((like) => like.taskId === taskId && like.userId === userId)) {
      likes.push({ taskId, userId });
    }
  });

export const unlikeTask: typeof newsApi.unlikeTask = (taskId) =>
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
  const user = fakeAuthBackend.currentUser();
  const index = comments.findIndex(
    (comment) => comment.id === commentId && comment.authorId === user?.id,
  );
  if (index >= 0) comments.splice(index, 1);
  return Promise.resolve();
};
