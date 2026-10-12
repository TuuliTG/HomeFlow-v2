import { useTaskImageUrls } from '@/features/tasks/useTasks';
import { useMessages } from '@/lib/i18n/i18n';

interface TaskImagesProps {
  /** File names of the task's pictures, in order. */
  paths: string[];
  title: string;
  currentUserId: string;
}

/** Thumbnails of a task's pictures, each opening the picture full size. */
export function TaskImages({ paths, title, currentUserId }: TaskImagesProps) {
  const urls = useTaskImageUrls(currentUserId, paths);
  const t = useMessages().tasks.card;

  if (paths.length === 0) return null;
  if (urls.isError) return <p className="text-xs text-red-700">{t.imagesFailed}</p>;
  return (
    <ul aria-label={t.images(title)} className="flex flex-wrap gap-2">
      {paths.map((path, index) => {
        const url = urls.data?.get(path);
        return (
          <li key={path}>
            {url === undefined ? (
              <div aria-hidden className="size-16 rounded-lg bg-slate-100" />
            ) : (
              <a href={url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={url}
                  alt={t.image(index + 1, title)}
                  className="size-16 rounded-lg border border-slate-200 object-cover"
                />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
