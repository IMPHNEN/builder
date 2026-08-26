/**
 * Whether `value` is the preview's base URL or a path/query/hash on top of it.
 */
export function isValidPreviewUrl(value: string, baseUrl: string): boolean {
  if (value === baseUrl) {
    return true;
  }

  if (value.startsWith(baseUrl)) {
    return ['/', '?', '#'].includes(value.charAt(baseUrl.length));
  }

  return false;
}
