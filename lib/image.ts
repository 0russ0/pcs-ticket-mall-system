export function proxiedImageUrl(url: string | null): string | null {
  if (!url) return null;
  return `/api/images?url=${encodeURIComponent(url)}`;
}
