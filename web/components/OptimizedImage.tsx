import Image from 'next/image';

/**
 * One image renderer for remote logos. Known image hosts go through Next's
 * optimizer (AVIF/WebP, resizing, long-lived cache); anything else — including
 * local previews — keeps the plain <img> path so an unusual stored URL can
 * never break a page.
 */
interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

const KNOWN_HOSTS = new Set([
  'placehold.co',
  'images.unsplash.com',
  'rxrrbznwnsgzpinirzme.supabase.co',
]);

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  sizes,
  priority = false,
}: OptimizedImageProps) {
  let optimizable = false;
  try {
    const url = new URL(src, 'https://local.invalid');
    optimizable =
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (KNOWN_HOSTS.has(url.hostname) || url.hostname.endsWith('.supabase.co'));
  } catch {
    optimizable = false;
  }

  if (!optimizable) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
