import { type ChangeEvent, useId, useState } from 'react';

import { MAX_TASK_IMAGES } from '@/features/tasks/task';
import type { DraftImage } from '@/features/tasks/taskImages';
import { shrinkImage } from '@/features/tasks/shrinkImage';
import { useTaskImageUrls } from '@/features/tasks/useTasks';
import { useMessages } from '@/lib/i18n/i18n';

function readAsDataUrl(image: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The picture could not be read'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('The picture could not be read'));
    };
    reader.readAsDataURL(image);
  });
}

/** A picture the user picked, shrunk to a JPEG and ready to show before it is uploaded. */
async function prepare(file: File): Promise<DraftImage> {
  const image = await shrinkImage(file);
  return { kind: 'new', key: crypto.randomUUID(), image, preview: await readAsDataUrl(image) };
}

interface TaskImagesFieldProps {
  images: DraftImage[];
  onChange: (images: DraftImage[]) => void;
  /** Tells the form while picked pictures are being prepared, so it isn't saved without them. */
  onPreparingChange: (isPreparing: boolean) => void;
  currentUserId: string;
}

/** The task's pictures on the form: add up to `MAX_TASK_IMAGES` from the camera or files, or remove them. */
export function TaskImagesField({
  images,
  onChange,
  onPreparingChange,
  currentUserId,
}: TaskImagesFieldProps) {
  const t = useMessages().taskForm.images;
  const labelId = useId();
  const hintId = useId();
  const [isPreparing, setIsPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const saved = images.flatMap((draft) => (draft.kind === 'saved' ? [draft.path] : []));
  const urls = useTaskImageUrls(currentUserId, saved);

  function setPreparing(preparing: boolean) {
    setIsPreparing(preparing);
    onPreparingChange(preparing);
  }

  async function add(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    // Lets the same file be picked again after removing it.
    input.value = '';
    const room = MAX_TASK_IMAGES - images.length;
    setProblem(files.length > room ? t.tooMany(MAX_TASK_IMAGES) : null);
    if (room <= 0 || files.length === 0) return;
    setPreparing(true);
    try {
      onChange([...images, ...(await Promise.all(files.slice(0, room).map(prepare)))]);
    } catch {
      setProblem(t.unreadable);
    } finally {
      setPreparing(false);
    }
  }

  function remove(index: number) {
    setProblem(null);
    onChange(images.filter((_, other) => other !== index));
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hintId}
      className="flex flex-col gap-2"
    >
      <span id={labelId} className="text-sm font-medium text-slate-700">
        {t.label}
      </span>
      <p id={hintId} className="-mt-1 text-sm text-slate-600">
        {t.hint(MAX_TASK_IMAGES)}
      </p>
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((draft, index) => {
            const src = draft.kind === 'new' ? draft.preview : urls.data?.get(draft.path);
            return (
              <li
                key={draft.kind === 'new' ? draft.key : draft.path}
                className="flex flex-col gap-1"
              >
                {src === undefined ? (
                  <div
                    {...(urls.isError
                      ? { role: 'img', 'aria-label': t.loadFailed }
                      : { 'aria-hidden': true })}
                    className="size-20 rounded-lg bg-slate-100"
                  />
                ) : (
                  <img
                    src={src}
                    alt={t.picture(index + 1)}
                    className="size-20 rounded-lg border border-slate-200 object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    remove(index);
                  }}
                  aria-label={t.remove(index + 1)}
                  disabled={isPreparing}
                  className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {t.removeButton}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {images.length < MAX_TASK_IMAGES && (
        <label className="border-brand-600 text-brand-900 hover:bg-brand-50 focus-within:outline-brand-600 flex min-h-11 w-fit cursor-pointer items-center rounded-lg border px-3 text-sm font-semibold focus-within:outline-2 focus-within:outline-offset-2">
          {isPreparing ? t.preparing : t.add}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isPreparing}
            onChange={(event) => {
              void add(event);
            }}
            className="sr-only"
          />
        </label>
      )}
      {problem && (
        <p role="alert" className="text-sm text-red-700">
          {problem}
        </p>
      )}
    </div>
  );
}
