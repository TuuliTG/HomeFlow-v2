import { z } from 'zod';

import { type NewsItem, type NewsPerson, workTypes } from '@/features/news/news';
import { getSupabaseClient } from '@/lib/supabase';

const newsRowsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    type: z.enum(workTypes),
    points: z.number(),
    completed_at: z.string(),
    completed_by: z.string().nullable(),
    task_likes: z.array(z.object({ user_id: z.string() })),
    task_comments: z.array(
      z.object({
        id: z.string(),
        author_id: z.string().nullable(),
        body: z.string(),
        created_at: z.string(),
      }),
    ),
  }),
);
const profileRowsSchema = z.array(z.object({ id: z.string(), display_name: z.string() }));
/** Postgres' unique_violation: the user has liked the task already. */
const ALREADY_LIKED = '23505';

type NewsRow = z.infer<typeof newsRowsSchema>[number];

function peopleIn(rows: NewsRow[]): string[] {
  const ids = rows.flatMap((row) => [
    row.completed_by,
    ...row.task_likes.map((like) => like.user_id),
    ...row.task_comments.map((comment) => comment.author_id),
  ]);
  return [...new Set(ids.filter((id): id is string => id !== null))];
}

async function fetchDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (error) throw error;
  return new Map(profileRowsSchema.parse(data).map((row) => [row.id, row.display_name]));
}

/**
 * The shared tasks done in the user's household since `since`, newest first, with who liked them and
 * their comments, oldest first. Row Level Security limits tasks, likes and comments to the household.
 */
export async function fetchNews(since: Date): Promise<NewsItem[]> {
  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .select(
      'id, title, type, points, completed_at, completed_by, task_likes(user_id), task_comments(id, author_id, body, created_at)',
    )
    .eq('is_private', false)
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: false })
    .order('created_at', { referencedTable: 'task_comments', ascending: true });
  if (error) throw error;
  const rows = newsRowsSchema.parse(data);
  const names = await fetchDisplayNames(peopleIn(rows));
  const person = (userId: string | null): NewsPerson => ({
    userId,
    name: userId ? (names.get(userId) ?? null) : null,
  });
  return rows.map((row) => ({
    taskId: row.id,
    title: row.title,
    type: row.type,
    points: row.points,
    completedAt: row.completed_at,
    doneBy: person(row.completed_by),
    likedBy: row.task_likes.map((like) => person(like.user_id)),
    comments: row.task_comments.map((comment) => ({
      id: comment.id,
      author: person(comment.author_id),
      body: comment.body,
      createdAt: comment.created_at,
    })),
  }));
}

/** Gives the user's thumbs up to a task someone else has done. */
export async function likeTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('task_likes').insert({ task_id: taskId });
  if (error && error.code !== ALREADY_LIKED) throw error;
}

/** Takes back the user's thumbs up; Row Level Security lets them delete only their own. */
export async function unlikeTask(taskId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('task_likes').delete().eq('task_id', taskId);
  if (error) throw error;
}

/** Comments on a done task; the database fills in the author. */
export async function addComment(taskId: string, body: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('task_comments')
    .insert({ task_id: taskId, body: body.trim() });
  if (error) throw error;
}

/** Deletes one of the user's own comments. */
export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await getSupabaseClient().from('task_comments').delete().eq('id', commentId);
  if (error) throw error;
}
