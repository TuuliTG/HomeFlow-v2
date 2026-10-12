/** The longest side of a task picture, in pixels: sharp on a phone, a few hundred kilobytes as a JPEG. */
export const MAX_IMAGE_SIDE = 1600;

const JPEG_QUALITY = 0.85;

/**
 * The picture redrawn as a JPEG at most `MAX_IMAGE_SIDE` pixels on its longest side. Redrawing also
 * leaves out the photo's metadata, such as where it was taken. Rejects when the browser can't read the
 * file as a picture.
 */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot draw pictures');
  // JPEG has no transparency, so transparent parts of a PNG become white rather than black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('The picture could not be saved as a JPEG'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
