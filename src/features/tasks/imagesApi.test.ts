import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as imagesApi from '@/features/tasks/imagesApi';

const supabase = vi.hoisted(() => {
  const bucket = { upload: vi.fn(), remove: vi.fn(), createSignedUrls: vi.fn() };
  return {
    bucket,
    client: { storage: { from: vi.fn(() => bucket) }, rpc: vi.fn() },
  };
});

vi.mock('@/lib/supabase', () => ({ getSupabaseClient: () => supabase.client }));

// setup.ts replaces this api with a fake for every test; this file tests the real one.
const api = await vi.importActual<typeof imagesApi>('@/features/tasks/imagesApi');
const { bucket, client } = supabase;
const failure = { message: 'boom' };

describe('task images api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a picture to a new file in the household's folder", async () => {
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    const image = new Blob(['jpeg'], { type: 'image/jpeg' });

    const path = await api.uploadTaskImage('h1', image);

    expect(path).toMatch(/^h1\/[0-9a-f-]{36}\.jpg$/);
    expect(client.storage.from).toHaveBeenCalledWith('task-images');
    expect(bucket.upload).toHaveBeenCalledWith(path, image, { contentType: 'image/jpeg' });
    expect(await api.uploadTaskImage('h1', image)).not.toBe(path);

    bucket.upload.mockResolvedValue({ data: null, error: failure });
    await expect(api.uploadTaskImage('h1', image)).rejects.toBe(failure);
  });

  it("sets a task's pictures", async () => {
    client.rpc.mockResolvedValue({ data: null, error: null });

    await api.setTaskImages('t1', ['h1/a.jpg']);

    expect(client.rpc).toHaveBeenCalledWith('set_task_images', {
      task_id: 't1',
      paths: ['h1/a.jpg'],
    });

    client.rpc.mockResolvedValue({ data: null, error: failure });
    await expect(api.setTaskImages('t1', [])).rejects.toBe(failure);
  });

  it('deletes files no task shows', async () => {
    bucket.remove.mockResolvedValue({ data: [], error: null });

    await api.deleteUnusedImageFiles([]);
    expect(bucket.remove).not.toHaveBeenCalled();

    await api.deleteUnusedImageFiles(['h1/a.jpg']);
    expect(bucket.remove).toHaveBeenCalledWith(['h1/a.jpg']);

    bucket.remove.mockResolvedValue({ data: null, error: failure });
    await expect(api.deleteUnusedImageFiles(['h1/a.jpg'])).rejects.toBe(failure);
  });

  it('reads addresses to show the pictures the user may see', async () => {
    bucket.createSignedUrls.mockResolvedValue({
      data: [
        { path: 'h1/a.jpg', signedUrl: 'https://example.com/a', error: null },
        { path: 'h1/b.jpg', signedUrl: null, error: 'Not found' },
      ],
      error: null,
    });

    const urls = await api.fetchImageUrls(['h1/a.jpg', 'h1/b.jpg']);

    expect(bucket.createSignedUrls).toHaveBeenCalledWith(['h1/a.jpg', 'h1/b.jpg'], 3600);
    expect([...urls]).toEqual([['h1/a.jpg', 'https://example.com/a']]);

    await expect(api.fetchImageUrls([])).resolves.toEqual(new Map());
    bucket.createSignedUrls.mockResolvedValue({ data: null, error: failure });
    await expect(api.fetchImageUrls(['h1/a.jpg'])).rejects.toBe(failure);
  });
});
