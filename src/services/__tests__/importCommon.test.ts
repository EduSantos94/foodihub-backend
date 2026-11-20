import { describe, it, expect, vi } from 'vitest';
import { formatTimestamp, matchSynonym, normalizeText, parseBoolean, parseDate, parseMoney, runImport, MAX_IMPORT_ROWS } from '../importCommon.js';

describe('parseMoney', () => {
  it.each([
    ['R$ 1.234,56', 1234.56],
    ['1.234,56', 1234.56],
    ['1234,56', 1234.56],
    ['1,234.56', 1234.56], // US style still understood
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['1234.56', 1234.56],
    ['0.123', 0.123],
    ['1.234', 1234], // a dot followed by exactly 3 digits is a thousands separator
    ['1.234.567', 1234567],
    ['10', 10],
    ['  R$ 7,90 ', 7.9],
    ['(10,00)', -10],
    ['-5,5', -5.5],
  ])('%s -> %s', (input, expected) => {
    expect(parseMoney(input)).toBeCloseTo(expected, 6);
  });

  it.each([[''], ['abc'], ['12abc'], ['1.2.3'], ['--5'], ['R$']])('rejects %j', (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  it('accepts numbers as they are', () => {
    expect(parseMoney(12.5)).toBe(12.5);
    expect(parseMoney(Number.NaN)).toBeNull();
  });
});

describe('parseDate', () => {
  it.each([
    ['25/12/2025', { date: '2025-12-25' }],
    ['5/3/2025', { date: '2025-03-05' }],
    ['25/12/25', { date: '2025-12-25' }],
    ['25-12-2025', { date: '2025-12-25' }],
    ['25.12.2025', { date: '2025-12-25' }],
    ['25/12/2025 14:30', { date: '2025-12-25', time: '14:30:00' }],
    ['25/12/2025 14:30:15', { date: '2025-12-25', time: '14:30:15' }],
    ['2025-12-25', { date: '2025-12-25' }],
    ['2025-12-25T14:30:00', { date: '2025-12-25', time: '14:30:00' }],
    ['2025-12-25 08:05:00.000Z', { date: '2025-12-25', time: '08:05:00' }],
    ['29/02/2024', { date: '2024-02-29' }],
  ])('%s', (input, expected) => {
    expect(parseDate(input)).toEqual(expected);
  });

  it('reads the Excel serial number, with and without time', () => {
    expect(parseDate('45000')).toEqual({ date: '2023-03-15' });
    expect(parseDate('45000.5')).toEqual({ date: '2023-03-15', time: '12:00:00' });
  });

  it.each([[''], ['31/02/2025'], ['29/02/2025'], ['32/01/2025'], ['25/13/2025'], ['abc'], ['25/12/2025 25:00'], ['12345'], ['25/12/1850']])('rejects %j', (input) => {
    expect(parseDate(input)).toBeNull();
  });

  it('formats for a timestamp column', () => {
    expect(formatTimestamp({ date: '2025-12-25', time: '14:30:00' })).toBe('2025-12-25 14:30:00');
    expect(formatTimestamp({ date: '2025-12-25' })).toBe('2025-12-25');
  });
});

describe('matchSynonym and parseBoolean', () => {
  const PAYMENT = {
    cash: ['dinheiro', 'especie'],
    credit_card: ['cartao de credito', 'credito'],
    debit_card: ['cartao de debito', 'debito'],
    pix: [],
  };

  it('matches ignoring case and accents, exact first and then by whole word', () => {
    expect(matchSynonym('Dinheiro', PAYMENT)).toBe('cash');
    expect(matchSynonym('Cartão de Crédito', PAYMENT)).toBe('credit_card');
    expect(matchSynonym('PIX', PAYMENT)).toBe('pix');
    expect(matchSynonym('cartão crédito visa', PAYMENT)).toBe('credit_card');
    expect(matchSynonym('débito', PAYMENT)).toBe('debit_card');
    expect(matchSynonym('cheque', PAYMENT)).toBeNull();
    expect(matchSynonym('', PAYMENT)).toBeNull();
  });

  it('reads yes/no words', () => {
    expect(parseBoolean('Sim')).toBe(true);
    expect(parseBoolean('Ativo')).toBe(true);
    expect(parseBoolean('NÃO')).toBe(false);
    expect(parseBoolean('inativo')).toBe(false);
    expect(parseBoolean('talvez')).toBeNull();
    expect(parseBoolean('')).toBeNull();
  });

  it('normalises text for comparison', () => {
    expect(normalizeText('  Pão   de  Açúcar! ')).toBe('pao de acucar');
  });
});

describe('runImport', () => {
  const spec = (known: Set<string> = new Set()) => ({
    prepare: (raw: any) => (raw.name ? { data: { name: String(raw.name) }, warnings: raw.warn ? ['w'] : [] } : { warnings: [], error: 'name_required' }),
    check: (d: { name: string }) => {
      if (known.has(d.name)) return 'name';
      known.add(d.name);
      return undefined;
    },
    insert: vi.fn(async () => undefined),
  });

  it('counts, reports and inserts only the accepted rows', async () => {
    const s = spec(new Set(['Existing']));
    const result = await runImport(
      [{ row: 2, name: 'A' }, { row: 3 }, { row: 4, name: 'Existing' }, { row: 5, name: 'B', warn: true }, { row: 6, name: 'A' }],
      false,
      s
    );
    expect(result).toMatchObject({ dry_run: false, total: 5, created: 2, duplicates: 2, errors: 1, with_warnings: 1, problems_truncated: false });
    expect(result.problems).toEqual([
      { row: 3, status: 'error', error: 'name_required', warnings: [] },
      { row: 4, status: 'duplicate', reason: 'name', warnings: [] },
      { row: 5, status: 'warning', warnings: ['w'] },
      { row: 6, status: 'duplicate', reason: 'name', warnings: [] },
    ]);
    expect(s.insert).toHaveBeenCalledWith([{ name: 'A' }, { name: 'B' }]);
  });

  it('does not insert on a dry run or when nothing is accepted', async () => {
    const s = spec();
    expect((await runImport([{ name: 'A' }], true, s)).created).toBe(1);
    expect((await runImport([{}], false, s)).created).toBe(0);
    expect(s.insert).not.toHaveBeenCalled();
  });

  it('numbers rows from 1 when the line is not sent', async () => {
    const result = await runImport([{ name: 'A' }, {}], true, spec());
    expect(result.problems[0].row).toBe(2);
  });

  it('rejects an empty list and more than the limit', async () => {
    await expect(runImport([], false, spec())).rejects.toThrow('non-empty');
    await expect(runImport('x', false, spec())).rejects.toThrow('non-empty');
    await expect(runImport(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ name: 'A' })), false, spec())).rejects.toThrow('Too many rows');
  });
});
