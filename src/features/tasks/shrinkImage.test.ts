import { afterEach, describe, expect, it, vi } from 'vitest';

import { shrinkImage } from '@/features/tasks/shrinkImage';

/** Stands in for the browser's picture decoding and canvas, which jsdom doesn't have. */
function fakeBrowser({ width, height }: { width: number; height: number }) {
  const close = vi.fn();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() => Promise.resolve({ width, height, close })),
  );
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(jpeg);
  });
  return { close, context, jpeg, toBlob };
}

describe('shrinkImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('redraws a large photo as a JPEG at most 1600 pixels on its longest side', async () => {
    const browser = fakeBrowser({ width: 4000, height: 3000 });

    const result = await shrinkImage(new Blob(['photo']));

    expect(result).toBe(browser.jpeg);
    expect(browser.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 1200);
    expect(browser.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
    expect(browser.close).toHaveBeenCalled();
  });

  it('keeps the size of a small picture and gives it a white background', async () => {
    const browser = fakeBrowser({ width: 300, height: 500 });

    await shrinkImage(new Blob(['screenshot']));

    expect(browser.context.fillStyle).toBe('#fff');
    expect(browser.context.fillRect).toHaveBeenCalledWith(0, 0, 300, 500);
    expect(browser.context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 500);
  });

  it('rejects a file the browser cannot read as a picture or save as a JPEG', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.reject(new Error('Not a picture'))),
    );
    await expect(shrinkImage(new Blob(['text']))).rejects.toThrow('Not a picture');

    const browser = fakeBrowser({ width: 10, height: 10 });
    browser.toBlob.mockImplementation((callback) => {
      callback(null);
    });
    await expect(shrinkImage(new Blob(['photo']))).rejects.toThrow();

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(shrinkImage(new Blob(['photo']))).rejects.toThrow();
  });
});
