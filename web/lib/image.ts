/**
 * Image helpers used before an upload.
 *
 * A phone photo is far too big for a storefront logo, so the picture is
 * scaled down in the browser and re-encoded before it is sent.
 */

export interface ResizedImage {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  bytes: number;
}

export async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.85,
): Promise<ResizedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('This browser cannot prepare the image.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Keep transparency for logos, everything else becomes a smaller jpeg.
  const keepAlpha = file.type === 'image/png';
  const type = keepAlpha ? 'image/png' : 'image/jpeg';

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
  if (!blob) throw new Error('This browser cannot prepare the image.');

  return { blob, type, width, height, bytes: blob.size };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
