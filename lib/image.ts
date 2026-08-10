export function proxiedImageUrl(url: string | null): string | null {
  if (!url) return null;
  // Private Blob storage requires a server-side proxy with auth token
  if (url.includes(".blob.vercel-storage.com")) {
    return `/api/images?url=${encodeURIComponent(url)}`;
  }
  // External public URLs (Amazon CDN, etc.) can be fetched directly by the browser
  return url;
}
