import { cleanName, limitText, matchSynonym, parseMoney, PreparedRow, text } from './importCommon.js';

export interface SupplyImportRow {
  row?: number;
  name?: string;
  type?: string;
  unit_measure?: string;
  /** Opening stock */
  amount?: string;
  description?: string;
}

export type SupplyType = 'ingredient' | 'packaging' | 'cleaning' | 'other';

export interface PreparedSupply {
  name: string;
  type: SupplyType;
  unit_measure: string;
  amount: number;
  description?: string;
}

const TYPES: Record<SupplyType, string[]> = {
  ingredient: ['ingrediente', 'ingredientes', 'insumo', 'materia prima', 'materia-prima', 'alimento', 'comida'],
  packaging: ['embalagem', 'embalagens', 'caixa', 'sacola', 'descartavel', 'descartaveis'],
  cleaning: ['limpeza', 'higiene', 'material de limpeza'],
  other: ['outro', 'outros', 'diversos', 'geral'],
};

// The units the screens offer (kg, g, L, ml, un, cx, pct, dz)
const UNITS: Record<string, string[]> = {
  kg: ['quilo', 'quilos', 'quilograma', 'quilogramas', 'kilo', 'kilos', 'kgs'],
  g: ['grama', 'gramas', 'gr', 'grs', 'gramas'],
  L: ['l', 'litro', 'litros', 'lt', 'lts', 'lit'],
  ml: ['mililitro', 'mililitros', 'mls'],
  un: ['unidade', 'unidades', 'und', 'unid', 'uni', 'peca', 'pecas', 'pc', 'pcs'],
  cx: ['caixa', 'caixas'],
  pct: ['pacote', 'pacotes', 'pct', 'pcte', 'embalagem'],
  dz: ['duzia', 'duzias', 'dz'],
};

/** A missing name is an error; an unknown type or unit falls back to a default with a warning. */
export function prepareSupplyRow(raw: SupplyImportRow): PreparedRow<PreparedSupply> {
  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  const name = cleanName(raw.name);
  if (!name) return { warnings, error: 'name_required' };

  let type: SupplyType = 'ingredient';
  const typeText = text(raw.type);
  if (typeText) {
    const matched = matchSynonym(typeText, TYPES);
    if (matched) type = matched;
    else warn('type_unknown');
  }

  let unit = 'un';
  const unitText = text(raw.unit_measure);
  if (unitText) {
    const matched = matchSynonym(unitText, UNITS);
    if (matched) unit = matched;
    else warn('unit_unknown');
  } else {
    warn('unit_missing');
  }

  let amount = 0;
  const amountText = text(raw.amount);
  if (amountText) {
    const n = parseMoney(amountText);
    if (n === null || n < 0) warn('amount_invalid');
    else amount = Math.round(n * 10000) / 10000;
  }

  const data: PreparedSupply = { name: limitText(name, 255, () => warn('truncated')), type, unit_measure: unit, amount };
  const description = text(raw.description);
  if (description) data.description = description;
  return { data, warnings };
}
