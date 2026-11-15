// supabase/functions/mcp/validate.ts
// Input validation for MCP tool arguments.
//
// Every value that reaches the database goes through one of these helpers.
// They reject unknown shapes, trim text, cap lengths and keep PostgREST filter
// fragments free of syntax characters.

export class ValidationError extends Error {
  field: string;

  constructor(field: string, message: string) {
    super(`${field} ${message}`);
    this.name = 'ValidationError';
    this.field = field;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function asRecord(
  value: unknown,
  field = 'arguments',
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(field, 'must be an object.');
  }
  return value as Record<string, unknown>;
}

function clean(value: string): string {
  // Keep newlines and tabs, drop other control characters.
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

export function stringField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean; min?: number; max?: number } = {},
): string | undefined {
  const raw = record[field];
  if (raw === undefined || raw === null || raw === '') {
    if (options.required) throw new ValidationError(field, 'is required.');
    return undefined;
  }
  if (typeof raw !== 'string') {
    throw new ValidationError(field, 'must be a string.');
  }
  const value = clean(raw).trim();
  if (value.length === 0) {
    if (options.required) throw new ValidationError(field, 'is required.');
    return undefined;
  }
  const min = options.min ?? 1;
  const max = options.max ?? 500;
  if (value.length < min) {
    throw new ValidationError(field, `must be at least ${min} characters.`);
  }
  if (value.length > max) {
    throw new ValidationError(field, `must be at most ${max} characters.`);
  }
  return value;
}

export function uuidField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean } = {},
): string | undefined {
  const value = stringField(record, field, {
    required: options.required,
    min: 36,
    max: 36,
  });
  if (!value) return undefined;
  if (!UUID_RE.test(value)) {
    throw new ValidationError(field, 'must be a valid UUID.');
  }
  return value.toLowerCase();
}

export function integerField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean; min?: number; max?: number; default?: number } = {},
): number | undefined {
  const raw = record[field];
  if (raw === undefined || raw === null) {
    if (options.default !== undefined) return options.default;
    if (options.required) throw new ValidationError(field, 'is required.');
    return undefined;
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new ValidationError(field, 'must be a whole number.');
  }
  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  if (raw < min || raw > max) {
    throw new ValidationError(field, `must be between ${min} and ${max}.`);
  }
  return raw;
}

export function emailField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean } = {},
): string | undefined {
  const value = stringField(record, field, {
    required: options.required,
    max: 254,
  });
  if (!value) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    throw new ValidationError(field, 'must be a valid email address.');
  }
  return value.toLowerCase();
}

export function phoneField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean } = {},
): string | undefined {
  const value = stringField(record, field, {
    required: options.required,
    max: 24,
  });
  if (!value) return undefined;
  if (!/^\+?[0-9][0-9\s()-]{6,22}$/.test(value)) {
    throw new ValidationError(field, 'must be a valid phone number.');
  }
  return value;
}

export function enumField<T extends string>(
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  options: { required?: boolean } = {},
): T | undefined {
  const value = stringField(record, field, {
    required: options.required,
    max: 40,
  });
  if (!value) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(
      field,
      `must be one of: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

export function isoDateField(
  record: Record<string, unknown>,
  field: string,
  options: { required?: boolean; future?: boolean } = {},
): string | undefined {
  const value = stringField(record, field, {
    required: options.required,
    max: 40,
  });
  if (!value) return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time)) {
    throw new ValidationError(field, 'must be a valid ISO 8601 date-time.');
  }
  if (options.future && time <= Date.now()) {
    throw new ValidationError(field, 'must be in the future.');
  }
  return new Date(time).toISOString();
}

/**
 * Keeps a user search term safe inside a PostgREST `or=(...)` filter.
 * Commas, parentheses and quotes are filter syntax; percent and underscore are
 * wildcards we add ourselves. Everything else that is letter, number, space,
 * apostrophe or hyphen is kept.
 */
export function searchTerm(value: string): string {
  return value
    .replace(/[(),%_*"'\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
