import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importPhone, prepareCustomerRow } from '../customerImport.js';
import { CustomerService, MAX_IMPORT_ROWS } from '../CustomerService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('importPhone', () => {
  it.each([
    ['11912345678', '11912345678'],
    ['(11) 91234-5678', '11912345678'],
    ['+55 11 91234-5678', '11912345678'],
    ['5511912345678', '11912345678'],
    ['011 91234-5678', '11912345678'],
    ['(11) 3456-7890', '1134567890'],
  ])('accepts %s', (input, expected) => {
    expect(importPhone(input)).toBe(expected);
  });

  it.each([['91234-5678'], ['123'], ['(00) 91234-5678'], ['abc'], ['']])('rejects "%s"', (input) => {
    expect(importPhone(input)).toBeNull();
  });
});

describe('prepareCustomerRow', () => {
  it('splits a full name into first and last name', () => {
    const { data } = prepareCustomerRow({ full_name: '  Maria   da Silva  ' });
    expect(data).toMatchObject({ first_name: 'Maria', last_name: 'da Silva' });
  });

  it('prefers explicit first and last name over the full name', () => {
    const { data } = prepareCustomerRow({ full_name: 'Fulano de Tal', first_name: 'Ana', last_name: 'Souza' });
    expect(data).toMatchObject({ first_name: 'Ana', last_name: 'Souza' });
  });

  it('is an error without a name', () => {
    expect(prepareCustomerRow({ phone: '11912345678' })).toEqual({ warnings: [], error: 'name_required' });
    expect(prepareCustomerRow({ full_name: '   ' }).error).toBe('name_required');
  });

  it('normalises phone, e-mail, CPF, CEP and state', () => {
    const { data, warnings } = prepareCustomerRow({
      first_name: 'João',
      phone: '+55 (11) 91234-5678',
      email: ' Joao@Email.COM ',
      cpf: '111.444.777-35',
      zip_code: '01310-100',
      state: 'sp',
    });
    expect(warnings).toEqual([]);
    expect(data).toEqual({
      first_name: 'João',
      phone: '11912345678',
      email: 'joao@email.com',
      cpf: '11144477735',
      zip_code: '01310100',
      state: 'SP',
    });
  });

  it('puts back the leading zeros a spreadsheet drops from CPF and CEP', () => {
    // 012.345.678-90 is a valid CPF; as a number it arrives as 1234567890 (10 digits)
    const { data, warnings } = prepareCustomerRow({ first_name: 'A', cpf: 1234567890 as any, zip_code: '1310100' });
    expect(warnings).toEqual([]);
    expect(data).toMatchObject({ cpf: '01234567890', zip_code: '01310100' });
    expect(prepareCustomerRow({ first_name: 'A', cpf: 11144477735 as any }).data?.cpf).toBe('11144477735');
  });

  it('drops invalid optional fields with a warning instead of failing the row', () => {
    const { data, warnings, error } = prepareCustomerRow({
      first_name: 'Carla',
      phone: '12345',
      email: 'not-an-email',
      cpf: '111.111.111-11',
      zip_code: '123',
      state: 'ZZ',
    });
    expect(error).toBeUndefined();
    expect(data).toEqual({ first_name: 'Carla' });
    expect(warnings.sort()).toEqual(['cpf_invalid', 'email_invalid', 'phone_invalid', 'state_invalid', 'zip_code_invalid']);
  });

  it('truncates values longer than the column and warns once', () => {
    const { data, warnings } = prepareCustomerRow({ first_name: 'x'.repeat(150), city: 'y'.repeat(150) });
    expect(data?.first_name).toHaveLength(100);
    expect(data?.city).toHaveLength(100);
    expect(warnings).toEqual(['truncated']);
  });

  it('turns numeric cells into text', () => {
    const { data } = prepareCustomerRow({ first_name: 'Beto', phone: 11912345678 as any });
    expect(data?.phone).toBe('11912345678');
  });
});

describe('CustomerService.importCustomers', () => {
  let service: CustomerService;
  let queries: { findContactKeys: any; bulkCreate: any };

  beforeEach(() => {
    service = new CustomerService();
    queries = { findContactKeys: vi.fn().mockResolvedValue([]), bulkCreate: vi.fn().mockResolvedValue(undefined) };
    (service as any).queries = queries;
  });

  it('inserts the valid rows in one batch for the store', async () => {
    const result = await service.importCustomers('store-1', [
      { full_name: 'Maria Silva', phone: '(11) 91234-5678' },
      { full_name: 'João Souza' },
    ]);
    expect(result).toMatchObject({ dry_run: false, total: 2, created: 2, duplicates: 0, errors: 0 });
    expect(queries.bulkCreate).toHaveBeenCalledTimes(1);
    expect(queries.bulkCreate).toHaveBeenCalledWith('store-1', [
      { first_name: 'Maria', last_name: 'Silva', phone: '11912345678' },
      { first_name: 'João', last_name: 'Souza' },
    ]);
  });

  it('saves nothing on a dry run but reports the same counts', async () => {
    const result = await service.importCustomers('store-1', [{ full_name: 'Maria Silva' }, { phone: '11912345678' }], { dry_run: true });
    expect(result).toMatchObject({ dry_run: true, created: 1, errors: 1 });
    expect(queries.bulkCreate).not.toHaveBeenCalled();
  });

  it('skips customers already registered by e-mail, CPF or phone, and repeats inside the file', async () => {
    queries.findContactKeys.mockResolvedValue([
      { first_name: 'Ana', email: 'ana@x.com' },
      { first_name: 'Bia', cpf: '11144477735' },
      { first_name: 'Caio', phone: '11999990000' },
    ]);
    const result = await service.importCustomers('store-1', [
      { row: 2, first_name: 'Ana', email: 'ANA@x.com' },
      { row: 3, first_name: 'Bia', cpf: '111.444.777-35' },
      { row: 4, first_name: 'Caio', phone: '(11) 99999-0000' },
      { row: 5, first_name: 'Duda', email: 'duda@x.com' },
      { row: 6, first_name: 'Duda de novo', email: 'duda@x.com' },
    ]);
    expect(result.created).toBe(1);
    expect(result.duplicates).toBe(4);
    expect(result.problems).toEqual([
      { row: 2, status: 'duplicate', reason: 'email', warnings: [] },
      { row: 3, status: 'duplicate', reason: 'cpf', warnings: [] },
      { row: 4, status: 'duplicate', reason: 'phone', warnings: [] },
      { row: 6, status: 'duplicate', reason: 'email', warnings: [] },
    ]);
  });

  it('compares by name only the rows that have no e-mail, CPF or phone', async () => {
    queries.findContactKeys.mockResolvedValue([{ first_name: 'Carla', last_name: 'Dias', phone: '11999990000' }]);
    const result = await service.importCustomers('store-1', [
      { row: 2, full_name: 'carla  DIAS' }, // same person, written differently
      { row: 3, full_name: 'Carla Souza' }, // different last name
      { row: 4, full_name: 'Carla Souza' }, // repeated inside the file
      { row: 5, full_name: 'Carla Dias', phone: '11988887777' }, // has a phone: not compared by name
    ]);
    expect(result.created).toBe(2);
    expect(result.problems).toEqual([
      { row: 2, status: 'duplicate', reason: 'name', warnings: [] },
      { row: 4, status: 'duplicate', reason: 'name', warnings: [] },
    ]);
  });

  it('can import customers that share a phone when skip_same_phone is false', async () => {
    const result = await service.importCustomers(
      'store-1',
      [{ first_name: 'Mãe', phone: '11999990000' }, { first_name: 'Filho', phone: '11999990000' }],
      { skip_same_phone: false }
    );
    expect(result.created).toBe(2);
  });

  it('reports warnings with the spreadsheet row and still imports the customer', async () => {
    const result = await service.importCustomers('store-1', [{ row: 7, first_name: 'Carla', phone: '123' }]);
    expect(result).toMatchObject({ created: 1, with_warnings: 1 });
    expect(result.problems).toEqual([{ row: 7, status: 'warning', warnings: ['phone_invalid'] }]);
  });

  it('numbers rows from 1 when the spreadsheet line is not sent', async () => {
    const result = await service.importCustomers('store-1', [{ first_name: 'A' }, { phone: '1' }]);
    expect(result.problems[0]).toMatchObject({ row: 2, status: 'error', error: 'name_required' });
  });

  it('rejects an empty list and more than the limit', async () => {
    await expect(service.importCustomers('store-1', [])).rejects.toThrow('non-empty');
    await expect(service.importCustomers('store-1', Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ({ first_name: 'A' })))).rejects.toThrow('Too many rows');
    expect(queries.bulkCreate).not.toHaveBeenCalled();
  });

  it('does not call the database to insert when every row failed', async () => {
    await service.importCustomers('store-1', [{ phone: '11912345678' }]);
    expect(queries.bulkCreate).not.toHaveBeenCalled();
  });
});
