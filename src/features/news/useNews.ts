import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addComment, deleteComment, fetchNews, likeTask, unlikeTask } from '@/features/news/api';
import { newsStart, type NewsItem } from '@/features/news/news';
import { today } from '@/lib/dates';

/** How often the news is refreshed while open, to show others' thumbs up and comments. */
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

/** Gives or takes back a thumbs up. It changes straight away and goes back if saving fails. */
export function useToggleLike(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = newsKey(userId);
  return useMutation({
    mutationFn: ({ taskId, liked }: { taskId: string; liked: boolean }) =>
      liked ? likeTask(taskId) : unlikeTask(taskId),
    onMutate: async ({ taskId, liked }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NewsItem[]>(queryKey);
      const toggle = (item: NewsItem): NewsItem => {
        if (item.taskId !== taskId) return item;
        const others = item.likedBy.filter((person) => person.userId !== userId);
        return { ...item, likedBy: liked ? [...others, { userId, name: null }] : others };
      };
      queryClient.setQueryData(queryKey, previous?.map(toggle));
      return { previous };
    },
    onError: (_error, _like, context) => {
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
