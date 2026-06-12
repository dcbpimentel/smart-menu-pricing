const UNIT_MAP = {
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg',
  gram: 'g', grams: 'g',
  liter: 'L', litre: 'L', liters: 'L', litres: 'L', ltr: 'L', ltrs: 'L',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml', ml: 'ml', mL: 'ml',
  piece: 'pcs', pieces: 'pcs', pc: 'pcs', pcs: 'pcs',
  kg: 'kg', g: 'g', l: 'L', L: 'L',
  pack: 'pack', pck: 'pack', packet: 'pack', packets: 'pack',
  bundle: 'bundle', bundles: 'bundle',
};

const normalizeEntry = (entry) => {
  const { raw_name, raw_unit, raw_price, date, source } = entry;
  let flagged = entry.flagged ?? false;
  let flag_reason = entry.flag_reason ?? null;

  // Normalize name: lowercase, strip parentheses + their content, collapse whitespace
  const normalized_name = (raw_name ?? '')
    .replace(/\(.*?\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize unit: lowercase key lookup, then fall back to the raw value trimmed
  const unitKey = (raw_unit ?? '').trim().toLowerCase();
  const normalized_unit = UNIT_MAP[unitKey] ?? UNIT_MAP[(raw_unit ?? '').trim()] ?? unitKey;

  if (!normalized_unit) {
    flagged = true;
    flag_reason = flag_reason ?? 'missing_unit';
  }

  // Normalize price
  const price = Math.round(parseFloat(raw_price) * 100) / 100;
  if (isNaN(price) || price === 0 || price > 5000) {
    flagged = true;
    flag_reason = flag_reason ?? 'unusual_price';
  }

  return {
    normalized_name,
    normalized_unit,
    price: isNaN(price) ? null : price,
    date,
    source,
    flagged,
    flag_reason,
  };
};

module.exports = { normalizeEntry };
