import { useEffect, useState } from 'react';

const urlCache = new Map<Blob, string>();

export function usePhotoUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!blob) return undefined;
    const cached = urlCache.get(blob);
    if (cached) return cached;
    const u = URL.createObjectURL(blob);
    urlCache.set(blob, u);
    return u;
  });

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const cached = urlCache.get(blob);
    if (cached) {
      setUrl(cached);
      return;
    }
    const u = URL.createObjectURL(blob);
    urlCache.set(blob, u);
    setUrl(u);
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
