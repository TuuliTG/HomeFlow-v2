import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addComment,
  deleteComment,
  fetchNews,
  reactToTask,
  removeReaction,
} from '@/features/news/api';
import { newsStart, type NewsItem, type NewsReaction, type Reaction } from '@/features/news/news';
import { today } from '@/lib/dates';

/** How often the news is refreshed while open, to show others' reactions and comments. */
const REFRESH_EVERY_MS = 60_000;

const newsKey = (userId: string) => ['news', userId] as const;

/** The household's done shared tasks of the last `NEWS_DAYS` days, newest first. */
export function useNews(userId: string) {
  return useQuery({
    queryKey: newsKey(userId),
    queryFn: () => fetchNews(newsStart(today())),
    refetchInterval: REFRESH_EVERY_MS,
  });
}

/**
 * Reacts with an emoji, changes it, or takes the reaction back (`emoji` null). It changes straight away and goes
 * back if saving fails.
 */
export function useReact(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = newsKey(userId);
  return useMutation({
    mutationFn: ({ taskId, emoji }: { taskId: string; emoji: Reaction | null }) =>
      emoji ? reactToTask(taskId, emoji) : removeReaction(taskId),
    onMutate: async ({ taskId, emoji }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NewsItem[]>(queryKey);
      const react = (item: NewsItem): NewsItem => {
        if (item.taskId !== taskId) return item;
        const isMine = (reaction: NewsReaction) => reaction.person.userId === userId;
        if (!emoji) return { ...item, reactions: item.reactions.filter((r) => !isMine(r)) };
        if (!item.reactions.some(isMine)) {
          return {
            ...item,
            reactions: [...item.reactions, { person: { userId, name: null }, emoji }],
          };
        }
        return {
          ...item,
          reactions: item.reactions.map((r) => (isMine(r) ? { ...r, emoji } : r)),
        };
      };
      queryClient.setQueryData(queryKey, previous?.map(react));
      return { previous };
    },
    onError: (_error, _reaction, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/** Comments on a task; stays pending until the news is refreshed, so the comment shows straight away. */
export function useAddComment(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) => addComment(taskId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: newsKey(userId) }),
  });
}

export function useDeleteComment(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: newsKey(userId) }),
  });
}
