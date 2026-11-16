import { describe, expect, it } from 'vitest';

import {
  authErrorMessage,
  csvCell,
  escapeHtml,
  imageExtension,
  normalizeWebsite,
  safeNextPath,
  validateImageUpload,
} from './security';

describe('safeNextPath', () => {
  it('keeps same-origin relative paths', () => {
    expect(safeNextPath('/vendor?tab=settings', '/fallback')).toBe('/vendor?tab=settings');
    expect(safeNextPath('/enterprise/products/123', '/fallback')).toBe('/enterprise/products/123');
  });

  it('rejects protocol-relative and absolute URLs', () => {
    expect(safeNextPath('//evil.example', '/fallback')).toBe('/fallback');
    expect(safeNextPath('https://evil.example', '/fallback')).toBe('/fallback');
    expect(safeNextPath('javascript:alert(1)', '/fallback')).toBe('/fallback');
  });

  it('rejects backslash tricks and control characters', () => {
    expect(safeNextPath('/\\evil.example', '/fallback')).toBe('/fallback');
    expect(safeNextPath('/vendor\u0000', '/fallback')).toBe('/fallback');
  });

  it('falls back for empty input', () => {
    expect(safeNextPath('', '/fallback')).toBe('/fallback');
    expect(safeNextPath(null, '/fallback')).toBe('/fallback');
  });
});

describe('image upload validation', () => {
  it('accepts only the exact allowlisted types', () => {
    expect(imageExtension('image/png')).toBe('png');
    expect(imageExtension('image/jpeg')).toBe('jpg');
    expect(imageExtension('image/webp')).toBe('webp');
    expect(imageExtension('image/svg+xml')).toBeNull();
    expect(imageExtension('text/html')).toBeNull();
    expect(imageExtension('IMAGE/PNG')).toBe('png');
  });

  it('rejects empty and oversized files', () => {
    expect(validateImageUpload({ type: 'image/png', size: 0 }).ok).toBe(false);
    expect(validateImageUpload({ type: 'image/png', size: 4 * 1024 * 1024 + 1 }).ok).toBe(false);
    expect(validateImageUpload({ type: 'image/png', size: 1024 })).toEqual({
      ok: true,
      extension: 'png',
    });
  });
});

describe('normalizeWebsite', () => {
  it('adds https when the scheme is missing', () => {
    expect(normalizeWebsite('example.com')).toBe('https://example.com/');
  });

  it('rejects non-http schemes and malformed hosts', () => {
    expect(normalizeWebsite('javascript:alert(1)')).toBeNull();
    expect(normalizeWebsite('ftp://example.com')).toBeNull();
    expect(normalizeWebsite('https://')).toBeNull();
    expect(normalizeWebsite('')).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<a href="https://evil">x</a>')).toBe(
      '&lt;a href=&quot;https://evil&quot;&gt;x&lt;/a&gt;',
    );
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });
});

describe('csvCell', () => {
  it('neutralises formula injection', () => {
    expect(csvCell('=HYPERLINK("https://evil","Invoice")')).toBe(
      "'=HYPERLINK(\"https://evil\",\"Invoice\")",
    );
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('authErrorMessage', () => {
  it('never leaks provider detail', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).not.toMatch(/invalid/i);
    expect(authErrorMessage(new Error('Email not confirmed'))).not.toMatch(/confirmed/i);
    expect(authErrorMessage(new Error('User already registered'))).not.toMatch(/registered/i);
    expect(authErrorMessage(new Error('For security purposes, you can only request this after 5 seconds'))).toMatch(
      /too many attempts/i,
    );
    expect(authErrorMessage(new Error('boom'))).toMatch(/something went wrong/i);
  });
});
