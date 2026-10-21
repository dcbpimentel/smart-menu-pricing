// Mirrors backend/utils/units.js so on-screen estimates match the server's costing.
const UNITS = {
  kg: { base: 'kg', factor: 1 },
  g:  { base: 'kg', factor: 0.001 },
  mg: { base: 'kg', factor: 0.000001 },
  lb: { base: 'kg', factor: 0.453592 },
  oz: { base: 'kg', factor: 0.0283495 },
  l:      { base: 'L', factor: 1 },
  ml:     { base: 'L', factor: 0.001 },
  cl:     { base: 'L', factor: 0.01 },
  dl:     { base: 'L', factor: 0.1 },
  tsp:    { base: 'L', factor: 0.00492892 },
  tbsp:   { base: 'L', factor: 0.0147868 },
  cup:    { base: 'L', factor: 0.236588 },
  'fl oz': { base: 'L', factor: 0.0295735 },
  pt:     { base: 'L', factor: 0.473176 },
  qt:     { base: 'L', factor: 0.946353 },
  gal:    { base: 'L', factor: 3.785411 },
  pc: { base: 'pc', factor: 1 },
};

const ALIASES = {
  kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  gm: 'g', gms: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  milligram: 'mg', milligrams: 'mg',
  lbs: 'lb', pound: 'lb', pounds: 'lb',
  ounce: 'oz', ounces: 'oz',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l', ltr: 'l', lt: 'l',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', mls: 'ml', cc: 'ml',
  teaspoon: 'tsp', teaspoons: 'tsp', tsps: 'tsp',
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp',
  cups: 'cup', c: 'cup',
  floz: 'fl oz', 'fl. oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pint: 'pt', pints: 'pt', quart: 'qt', quarts: 'qt', gallon: 'gal', gallons: 'gal',
  pcs: 'pc', piece: 'pc', pieces: 'pc', pce: 'pc', ea: 'pc', each: 'pc', unit: 'pc', units: 'pc',
};

export const normalizeUnit = (unit) => {
  if (unit == null) return '';
  const u = String(unit).trim().toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ');
  return ALIASES[u] ?? u;
};

// Multiplier converting a quantity in fromUnit into toUnit; null if they can't convert.
export const getConversionFactor = (fromUnit, toUnit) => {
  const from = normalizeUnit(fromUnit);
  const to   = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return 1;
  const a = UNITS[from];
  const b = UNITS[to];
  if (!a || !b || a.base !== b.base) return null;
  return a.factor / b.factor;
};

// Units a recipe can use for an ingredient priced per baseUnit (the base unit itself first)
const CHOICES = {
  kg: ['kg', 'g', 'mg', 'lb', 'oz'],
  L:  ['L', 'ml', 'tbsp', 'tsp', 'cup'],
  pc: ['pcs'],
};

export const unitOptionsFor = (baseUnit) => {
  if (!baseUnit) return [];
  const dim = UNITS[normalizeUnit(baseUnit)]?.base;
  const list = dim ? CHOICES[dim] : [];
  return [baseUnit, ...list.filter(u => normalizeUnit(u) !== normalizeUnit(baseUnit))];
};
