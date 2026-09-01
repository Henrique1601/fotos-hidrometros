import { useEffect, useState } from 'react';

const MAX_CACHE_SIZE = 40;
const urlCache = new Map<Blob, string>();

function getOrCreateUrl(blob: Blob): string {
  const cached = urlCache.get(blob);
  if (cached) return cached;

  if (urlCache.size >= MAX_CACHE_SIZE) {
    const firstBlob = urlCache.keys().next().value;
    if (firstBlob) {
      const oldUrl = urlCache.get(firstBlob);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      urlCache.delete(firstBlob);
    }
  }

  const u = URL.createObjectURL(blob);
  urlCache.set(blob, u);
  return u;
}

export function usePhotoUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!blob) return undefined;
    return getOrCreateUrl(blob);
  });

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    setUrl(getOrCreateUrl(blob));
  }, [blob]);

  return url;
}

export function revokeStaleUrls(keep: Set<Blob>) {
  for (const [blob, url] of urlCache) {
    if (!keep.has(blob)) {
      URL.revokeObjectURL(url);
      urlCache.delete(blob);
    }
  }
}
