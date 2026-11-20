import { importPhone } from './customerImport.js';

/**
 * Pieces shared by every spreadsheet import (suppliers, supplies, products, purchases, sales):
 * tolerant converters for what people type in spreadsheets, and an engine that runs the same
 * dry-run / report / insert flow for any resource.
 */

export const MAX_IMPORT_ROWS = 5000;
export const MAX_REPORTED_PROBLEMS = 200;

// ==================== Report ====================

export interface ImportProblem {
  /** Line in the spreadsheet */
  row: number;
  status: 'error' | 'duplicate' | 'warning';
  error?: string;
  /** What matched an existing record, for status "duplicate" */
  reason?: string;
  warnings: string[];
}

export interface ImportResult {
  dry_run: boolean;
  total: number;
  /** Rows imported (or that would be, on a dry run) */
  created: number;
  duplicates: number;
  errors: number;
  with_warnings: number;
  problems: ImportProblem[];
  problems_truncated: boolean;
  /** Identifies the imported batch so it can be undone (history imports) */
  batch_id?: string;
  /** When several rows become one record (an order or a purchase): how many records were created */
  records?: number;
}

export interface PreparedRow<P> {
  data?: P;
  warnings: string[];
  error?: string;
}

export interface ImportSpec<P> {
  prepare: (raw: any) => PreparedRow<P>;
  /**
   * Returns why the row repeats something already known (the database or an earlier row of the file),
   * or undefined when it is new. When it is new it must also remember the row's keys.
   */
  check: (data: P) => string | undefined;
  insert: (rows: P[]) => Promise<void>;
}

/** The list sent by the client, validated (a non-empty array within the limit). */
export function assertRows(rows: unknown): any[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows must be a non-empty list');
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows: the limit is ${MAX_IMPORT_ROWS} per import`);
  return rows;
}

export async function runImport<P>(rows: unknown, dryRun: boolean, spec: ImportSpec<P>): Promise<ImportResult> {
  const list = assertRows(rows);
  const accepted: P[] = [];
  const problems: ImportProblem[] = [];
  let duplicates = 0;
  let errors = 0;
  let withWarnings = 0;

  list.forEach((raw, index) => {
    const row = Number.isInteger(raw?.row) ? (raw.row as number) : index + 1;
    const { data, warnings, error } = spec.prepare(raw ?? {});

    if (!data) {
      errors++;
      problems.push({ row, status: 'error', error, warnings });
      return;
    }
    const reason = spec.check(data);
    if (reason) {
      duplicates++;
      problems.push({ row, status: 'duplicate', reason, warnings });
      return;
    }
    if (warnings.length > 0) {
      withWarnings++;
      problems.push({ row, status: 'warning', warnings });
    }
    accepted.push(data);
  });

  if (!dryRun && accepted.length > 0) await spec.insert(accepted);

  return {
    dry_run: dryRun,
    total: list.length,
    created: accepted.length,
    duplicates,
    errors,
    with_warnings: withWarnings,
    problems: problems.slice(0, MAX_REPORTED_PROBLEMS),
    problems_truncated: problems.length > MAX_REPORTED_PROBLEMS,
  };
}

// ==================== Grouped import ====================

export interface GroupedSpec<L, G> {
  prepare: (raw: any) => PreparedRow<L>;
  /** Rows with the same key become one record */
  groupKey: (line: L) => string;
  /** Combines the lines of one group into the record to save */
  build: (lines: L[]) => G;
  /** Same contract as ImportSpec.check, for the whole record */
  check: (record: G) => string | undefined;
  insert: (records: G[]) => Promise<void>;
}

/**
 * Like runImport, for spreadsheets with one row per item (sales, purchases): the valid rows are grouped
 * into records. `created` and `duplicates` still count spreadsheet rows; `records` counts what is saved.
 * A repeated record makes all of its rows "duplicate".
 */
export async function runGroupedImport<L, G>(rows: unknown, dryRun: boolean, spec: GroupedSpec<L, G>): Promise<ImportResult> {
  const list = assertRows(rows);
  const problems: ImportProblem[] = [];
  let errors = 0;
  let duplicates = 0;
  let created = 0;
  let withWarnings = 0;

  type Line = { row: number; data: L; warnings: string[] };
  const groups = new Map<string, Line[]>();

  list.forEach((raw, index) => {
    const row = Number.isInteger(raw?.row) ? (raw.row as number) : index + 1;
    const { data, warnings, error } = spec.prepare(raw ?? {});
    if (!data) {
      errors++;
      problems.push({ row, status: 'error', error, warnings });
      return;
    }
    const key = spec.groupKey(data);
    const bucket = groups.get(key);
    if (bucket) bucket.push({ row, data, warnings });
    else groups.set(key, [{ row, data, warnings }]);
  });

  const accepted: G[] = [];
  for (const lines of groups.values()) {
    const record = spec.build(lines.map((l) => l.data));
    const reason = spec.check(record);
    if (reason) {
      for (const l of lines) {
        duplicates++;
        problems.push({ row: l.row, status: 'duplicate', reason, warnings: l.warnings });
      }
      continue;
    }
    accepted.push(record);
    for (const l of lines) {
      created++;
      if (l.warnings.length > 0) {
        withWarnings++;
        problems.push({ row: l.row, status: 'warning', warnings: l.warnings });
      }
    }
  }

  if (!dryRun && accepted.length > 0) await spec.insert(accepted);

  problems.sort((a, b) => a.row - b.row);
  return {
    dry_run: dryRun,
    total: list.length,
    created,
    duplicates,
    errors,
    with_warnings: withWarnings,
    problems: problems.slice(0, MAX_REPORTED_PROBLEMS),
    problems_truncated: problems.length > MAX_REPORTED_PROBLEMS,
    records: accepted.length,
  };
}

// ==================== Text ====================

// What people type in a spreadsheet instead of leaving a cell empty
const PLACEHOLDERS = new Set(['—', '–', '-', '--', '---', 'n/a']);

export const text = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return PLACEHOLDERS.has(s.toLowerCase()) ? '' : s;
};

/** Lower case, no accents, single spaces: how names and synonyms are compared. */
export const normalizeText = (value: unknown): string =>
  text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A name as stored: trimmed, inner spaces collapsed. */
export const cleanName = (value: unknown): string => text(value).replace(/\s+/g, ' ');

/** Cuts a value to the column size; reports it through `onTruncate`. */
export function limitText(value: string, max: number, onTruncate: () => void): string {
  if (value.length <= max) return value;
  onTruncate();
  return value.slice(0, max);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const cleanEmail = (value: unknown): string | null => {
  const email = text(value).toLowerCase();
  return email.length > 0 && email.length <= 255 && EMAIL.test(email) ? email : null;
};

export { importPhone };

// ==================== Numbers ====================

/**
 * "R$ 1.234,56", "1234,5", "12.5", "(10,00)" -> number; null when it is not a number.
 * A comma is always the decimal separator. A dot is a thousands separator when it is followed by
 * exactly three digits ("1.234" is 1234), otherwise it is the decimal point ("12.5", "1234.56").
 */
export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value ?? '').trim().replace(/^(?:R\$|US\$|\$)\s*/i, '').replace(/\s/g, '');
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^[0-9.,]+$/.test(s)) return null;

  let normalized: string;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normalized = s.split(thousands).join('').replace(decimal, '.');
  } else if (hasComma) {
    const parts = s.split(',');
    normalized = parts.length === 2 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else if (hasDot) {
    const parts = s.split('.');
    const tail = parts.slice(1);
    const groupsOfThree = tail.every((p) => p.length === 3);
    if (parts.length > 2) {
      if (!groupsOfThree) return null;
      normalized = parts.join('');
    } else if (groupsOfThree && parts[0] !== '0' && parts[0].length >= 1 && parts[0].length <= 3) {
      normalized = parts.join('');
    } else {
      normalized = s;
    }
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

// ==================== Booleans and synonyms ====================

const TRUE_WORDS = ['sim', 's', 'true', 'verdadeiro', '1', 'ativo', 'ativa', 'yes', 'y'];
const FALSE_WORDS = ['nao', 'n', 'false', 'falso', '0', 'inativo', 'inativa', 'no'];

/** "sim"/"não"/"ativo"/"inativo"/"1"/"0" -> boolean; null when unknown or empty. */
export function parseBoolean(value: unknown): boolean | null {
  const v = normalizeText(value);
  if (!v) return null;
  if (TRUE_WORDS.includes(v)) return true;
  if (FALSE_WORDS.includes(v)) return false;
  return null;
}

/**
 * Maps what someone wrote ("Cartão de Crédito", "PIX", "quilos") to one of our values, through a
 * table of Portuguese synonyms. Exact match first, then a whole-word match. null when nothing fits.
 */
export function matchSynonym<T extends string>(value: unknown, table: Record<T, string[]>): T | null {
  const v = normalizeText(value);
  if (!v) return null;
  const entries = Object.entries(table) as [T, string[]][];
  for (const [key, words] of entries) {
    if (normalizeText(key) === v || words.some((w) => normalizeText(w) === v)) return key;
  }
  for (const [key, words] of entries) {
    if ([key as string, ...words].some((w) => ` ${v} `.includes(` ${normalizeText(w)} `))) return key;
  }
  return null;
}

// ==================== Dates ====================

export interface ParsedDate {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM:SS, when the value had a time */
  time?: string;
}

const pad = (n: number, size = 2): string => String(n).padStart(size, '0');

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function build(year: number, month: number, day: number, h?: number, m?: number, s?: number): ParsedDate | null {
  if (!validDate(year, month, day)) return null;
  const parsed: ParsedDate = { date: `${pad(year, 4)}-${pad(month)}-${pad(day)}` };
  if (h !== undefined) {
    if (h > 23 || (m ?? 0) > 59 || (s ?? 0) > 59) return null;
    parsed.time = `${pad(h)}:${pad(m ?? 0)}:${pad(s ?? 0)}`;
  }
  return parsed;
}

/**
 * Dates as they come from spreadsheets: 25/12/2025, 25/12/25, 25-12-2025, 25.12.2025 (optionally
 * followed by a time), 2025-12-25 and 2025-12-25T14:30:00, and the Excel serial number (45000).
 * Returns null when it is not a real date.
 */
export function parseDate(value: unknown): ParsedDate | null {
  const s = text(value);
  if (!s) return null;

  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return build(year, Number(m[2]), Number(m[1]), m[4] === undefined ? undefined : Number(m[4]), m[5] === undefined ? undefined : Number(m[5]), m[6] === undefined ? undefined : Number(m[6]));
  }

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?Z?)?$/.exec(s);
  if (m) {
    return build(Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? undefined : Number(m[4]), m[5] === undefined ? undefined : Number(m[5]), m[6] === undefined ? undefined : Number(m[6]));
  }

  // Excel serial number (days since 1899-12-30, the fraction is the time of day)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s);
    if (serial >= 20000 && serial <= 80000) {
      const ms = Math.round((serial - Math.floor(serial)) * 86400) * 1000;
      const day = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
      const secs = ms / 1000;
      const hasTime = secs > 0;
      return build(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hasTime ? Math.floor(secs / 3600) : undefined, hasTime ? Math.floor((secs % 3600) / 60) : undefined, hasTime ? secs % 60 : undefined);
    }
  }
  return null;
}

/** "2025-12-25 14:30:00" (timestamp without time zone) or "2025-12-25" when there is no time. */
export const formatTimestamp = (d: ParsedDate): string => (d.time ? `${d.date} ${d.time}` : d.date);

/** Brazil has no daylight saving time now: spreadsheet times are UTC-3. The database keeps timestamps in UTC. */
export const BRAZIL_UTC_OFFSET_HOURS = 3;

/**
 * A spreadsheet date (and time) as the "YYYY-MM-DD HH:MM:SS" UTC timestamp the database stores. A date
 * without a time becomes noon in Brazil, so it keeps its day in any time zone the screens use.
 */
export function toUtcTimestamp(d: ParsedDate, defaultTime = '12:00:00'): string {
  const [y, mo, da] = d.date.split('-').map(Number);
  const [h, mi, se] = (d.time ?? defaultTime).split(':').map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, da, h + BRAZIL_UTC_OFFSET_HOURS, mi, se));
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())} ${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}`;
}

/** Money rounded to cents. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
