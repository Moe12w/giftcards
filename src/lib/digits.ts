// src/lib/digits.ts
// Numbers and dates always render with Latin digits (0-9), even in Arabic.
//
// Some engines ignore the `numberingSystem: 'latn'` option (Hermes on Android
// in particular) and fall back to Arabic-Indic digits, so every formatted
// string is also rewritten as a safety net.

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXTENDED_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

/** Rewrite Arabic-Indic and extended Arabic digits as 0-9. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(EXTENDED_ARABIC.indexOf(digit)))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, ',');
}

