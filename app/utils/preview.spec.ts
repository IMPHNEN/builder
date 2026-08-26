import { describe, expect, it } from 'vitest';
import { isValidPreviewUrl } from './preview';

const baseUrl = 'http://localhost:5173';

describe('isValidPreviewUrl', () => {
  it('should accept the exact base URL', () => {
    expect(isValidPreviewUrl(baseUrl, baseUrl)).toBe(true);
  });

  it('should accept a path on the base URL', () => {
    expect(isValidPreviewUrl(`${baseUrl}/about`, baseUrl)).toBe(true);
  });

  it('should accept a query string on the base URL', () => {
    expect(isValidPreviewUrl(`${baseUrl}?foo=1`, baseUrl)).toBe(true);
  });

  it('should accept a hash on the base URL', () => {
    expect(isValidPreviewUrl(`${baseUrl}#section`, baseUrl)).toBe(true);
  });

  it('should reject a different origin', () => {
    expect(isValidPreviewUrl('http://localhost:3000/about', baseUrl)).toBe(false);
  });

  it('should reject a base-URL prefix that is not a path boundary', () => {
    expect(isValidPreviewUrl(`${baseUrl}evil`, baseUrl)).toBe(false);
  });

  it('should reject an unrelated URL', () => {
    expect(isValidPreviewUrl('https://example.com', baseUrl)).toBe(false);
  });
});
