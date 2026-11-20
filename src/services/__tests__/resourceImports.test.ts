import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prepareSupplierRow } from '../supplierImport.js';
import { prepareSupplyRow } from '../supplyImport.js';
import { prepareProductRow } from '../productImport.js';
import { SupplierService } from '../SupplierService.js';
import { SupplyService } from '../SupplyService.js';
import { ProductService } from '../ProductService.js';
import { SupplierModel } from '../../database/models/SupplierModel.js';
import { SupplyModel } from '../../database/models/SupplyModel.js';
import { ProductModel } from '../../database/models/ProductModel.js';
import { CategoryModel } from '../../database/models/CategoryModel.js';
import { createDataSource } from '../../database/connection.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('prepareSupplierRow', () => {
  it('needs a name', () => {
    expect(prepareSupplierRow({ cnpj: '11.222.333/0001-81' })).toEqual({ warnings: [], error: 'name_required' });
  });

  it('normalises documents, phone, e-mail, CEP and state', () => {
    const { data, warnings } = prepareSupplierRow({
      name: '  Distribuidora   ABC ',
      cnpj: '11.222.333/0001-81',
      phone: '+55 (11) 3456-7890',
      email: ' Vendas@ABC.com ',
      zip_code: 1310100 as any,
      state: 'sp',
      contact_person: 'Seu  João',
    });
    expect(warnings).toEqual([]);
    expect(data).toEqual({
      name: 'Distribuidora ABC',
      cnpj: '11222333000181',
      phone: '1134567890',
      email: 'vendas@abc.com',
      zip_code: '01310100',
      state: 'SP',
      contact_person: 'Seu João',
    });
  });

  it('accepts an alphanumeric CNPJ', () => {
    expect(prepareSupplierRow({ name: 'X', cnpj: '12.abc.345/01de-35' }).data?.cnpj).toBe('12ABC34501DE35');
  });

  it('drops invalid optional fields with warnings', () => {
    const { data, warnings, error } = prepareSupplierRow({ name: 'X', cnpj: '11.222.333/0001-80', phone: '12', email: 'x', zip_code: '1', state: 'ZZ' });
    expect(error).toBeUndefined();
    expect(data).toEqual({ name: 'X' });
    expect(warnings.sort()).toEqual(['cnpj_invalid', 'email_invalid', 'phone_invalid', 'state_invalid', 'zip_code_invalid']);
  });
});

describe('prepareSupplyRow', () => {
  it('needs a name', () => {
    expect(prepareSupplyRow({ unit_measure: 'kg' }).error).toBe('name_required');
  });

  it.each([
    ['quilo', 'kg'],
    ['Quilogramas', 'kg'],
    ['gramas', 'g'],
    ['Litros', 'L'],
    ['ML', 'ml'],
    ['unidade', 'un'],
    ['Caixa', 'cx'],
    ['pacote', 'pct'],
    ['dúzia', 'dz'],
  ])('unit "%s" -> %s', (input, expected) => {
    expect(prepareSupplyRow({ name: 'X', unit_measure: input }).data?.unit_measure).toBe(expected);
  });

  it.each([
    ['Ingrediente', 'ingredient'],
    ['matéria-prima', 'ingredient'],
    ['Embalagem', 'packaging'],
    ['Limpeza', 'cleaning'],
    ['outros', 'other'],
  ])('type "%s" -> %s', (input, expected) => {
    expect(prepareSupplyRow({ name: 'X', type: input }).data?.type).toBe(expected);
  });

  it('defaults with warnings when type or unit are unknown or missing', () => {
    const a = prepareSupplyRow({ name: 'X', type: 'fardo', unit_measure: 'barril' });
    expect(a.data).toMatchObject({ type: 'ingredient', unit_measure: 'un' });
    expect(a.warnings.sort()).toEqual(['type_unknown', 'unit_unknown']);
    expect(prepareSupplyRow({ name: 'X' }).warnings).toEqual(['unit_missing']);
  });

  it('reads the opening stock in Brazilian format and flags nonsense', () => {
    expect(prepareSupplyRow({ name: 'X', unit_measure: 'kg', amount: '1.250,5' }).data?.amount).toBe(1250.5);
    expect(prepareSupplyRow({ name: 'X', unit_measure: 'kg', amount: '12,5' }).data?.amount).toBe(12.5);
    const bad = prepareSupplyRow({ name: 'X', unit_measure: 'kg', amount: 'muito' });
    expect(bad.data?.amount).toBe(0);
    expect(bad.warnings).toEqual(['amount_invalid']);
    expect(prepareSupplyRow({ name: 'X', unit_measure: 'kg', amount: '-3' }).warnings).toEqual(['amount_invalid']);
  });
});

describe('prepareProductRow', () => {
  const categories = new Map([['pizzas', 'cat-1'], ['bebidas', 'cat-2']]);

  it('needs a name', () => {
    expect(prepareProductRow({ price: '10' }, categories).error).toBe('name_required');
  });

  it('reads price, stock, category and active', () => {
    const { data, warnings } = prepareProductRow({ name: ' Pizza   Calabresa ', price: 'R$ 45,90', amount: '12', category: 'Pizzas', active: 'Sim', description: 'Grande' }, categories);
    expect(warnings).toEqual([]);
    expect(data).toEqual({ name: 'Pizza Calabresa', price: 45.9, amount: 12, category_id: 'cat-1', active: true, description: 'Grande' });
  });

  it('defaults price and stock to zero and active to true', () => {
    expect(prepareProductRow({ name: 'X' }, categories).data).toEqual({ name: 'X', price: 0, amount: 0, active: true });
  });

  it('can import an inactive product', () => {
    expect(prepareProductRow({ name: 'X', active: 'inativo' }, categories).data?.active).toBe(false);
  });

  it('warns about a bad price, stock, category or active value without losing the product', () => {
    const { data, warnings } = prepareProductRow({ name: 'X', price: 'grátis', amount: '-2', category: 'Sobremesas', active: 'quem sabe' }, categories);
    expect(data).toEqual({ name: 'X', price: 0, amount: 0, active: true });
    expect(warnings.sort()).toEqual(['active_unknown', 'amount_invalid', 'category_unknown', 'price_invalid']);
  });

  it('rounds a fractional stock and says so', () => {
    const { data, warnings } = prepareProductRow({ name: 'X', amount: '2,6' }, categories);
    expect(data?.amount).toBe(3);
    expect(warnings).toEqual(['amount_rounded']);
  });
});

// ---- services, with a fake data source ----
describe('import services', () => {
  const inserted: { target: unknown; values: any[] }[] = [];
  let existing: Map<unknown, any[]>;

  beforeEach(() => {
    inserted.length = 0;
    existing = new Map();
    const manager = {
      createQueryBuilder: () => {
        let target: unknown;
        const qb: any = {
          insert: () => qb,
          into: (t: unknown) => ((target = t), qb),
          values: (v: any[]) => (inserted.push({ target, values: v }), qb),
          execute: async () => undefined,
        };
        return qb;
      },
    };
    (createDataSource as any).mockResolvedValue({
      getRepository: (model: unknown) => ({ find: vi.fn(async () => existing.get(model) ?? []) }),
      transaction: async (cb: any) => cb(manager),
    });
  });

  it('suppliers: skips an existing CNPJ or name, inserts the rest for the store', async () => {
    existing.set(SupplierModel, [{ name: 'Velho', cnpj: '11.222.333/0001-81' }, { name: 'Outro', cnpj: null }]);
    const result = await new SupplierService().importSuppliers('store-1', [
      { row: 2, name: 'Novo', cnpj: '34.028.316/0001-03' },
      { row: 3, name: 'Qualquer', cnpj: '11222333000181' }, // CNPJ already registered (stored with punctuation)
      { row: 4, name: 'outro' }, // same name, different case
      { row: 5, name: 'Novo 2' },
      { row: 6, name: 'NOVO' }, // repeats row 2
    ]);
    expect(result).toMatchObject({ created: 2, duplicates: 3, errors: 0 });
    expect(result.problems.map((p) => [p.row, p.reason])).toEqual([[3, 'cnpj'], [4, 'name'], [6, 'name']]);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].target).toBe(SupplierModel);
    expect(inserted[0].values).toEqual([
      { name: 'Novo', cnpj: '34028316000103', store_id: 'store-1', active: true },
      { name: 'Novo 2', store_id: 'store-1', active: true },
    ]);
  });

  it('supplies: dedupes by name and keeps the opening stock', async () => {
    existing.set(SupplyModel, [{ name: 'Farinha de Trigo' }]);
    const result = await new SupplyService().importSupplies('store-1', [
      { name: 'farinha de trigo', unit_measure: 'kg' },
      { name: 'Queijo', unit_measure: 'kg', amount: '10,5' },
    ]);
    expect(result).toMatchObject({ created: 1, duplicates: 1 });
    expect(inserted[0].values).toEqual([{ name: 'Queijo', type: 'ingredient', unit_measure: 'kg', amount: 10.5, store_id: 'store-1', active: true }]);
  });

  it('products: matches categories by name and dedupes by name', async () => {
    existing.set(ProductModel, [{ name: 'Pizza Mussarela' }]);
    existing.set(CategoryModel, [{ id: 'cat-1', name: 'Pizzas' }]);
    const result = await new ProductService().importProducts('store-1', [
      { name: 'Pizza Mussarela', price: '40' },
      { name: 'Pizza Calabresa', price: '45,90', amount: '5', category: 'pizzas' },
    ]);
    expect(result).toMatchObject({ created: 1, duplicates: 1 });
    expect(inserted[0].target).toBe(ProductModel);
    expect(inserted[0].values).toEqual([{ name: 'Pizza Calabresa', price: 45.9, amount: 5, category_id: 'cat-1', active: true, store_id: 'store-1' }]);
  });

  it('writes nothing on a dry run', async () => {
    const result = await new SupplierService().importSuppliers('store-1', [{ name: 'Novo' }], { dry_run: true });
    expect(result).toMatchObject({ dry_run: true, created: 1 });
    expect(inserted).toHaveLength(0);
  });
});
