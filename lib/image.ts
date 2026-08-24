export function proxiedImageUrl(url: string | null): string | null {
  if (!url) return null;
  // Private Blob storage requires a server-side proxy with auth token
  if (url.includes(".blob.vercel-storage.com")) {
    return `/api/images?url=${encodeURIComponent(url)}`;
  }
  // Google Drive "share" links (…/file/d/{id}/view) point at an HTML viewer
  // page, not an image — rewrite to a directly embeddable thumbnail URL.
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
  }
  // External public URLs (Amazon CDN, etc.) can be fetched directly by the browser
  return url;
}
