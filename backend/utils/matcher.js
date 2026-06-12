const { distance } = require('fastest-levenshtein');

// Mirror the same normalization applied to raw_name in normalizer.js
const normalizeName = (name) =>
  name
    .replace(/\(.*?\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchToIngredient = async (normalized_name, db) => {
  const [rows] = await db.query('SELECT id, name FROM ingredients');

  let bestId = null;
  let bestName = null;
  let bestDist = Infinity;

  for (const row of rows) {
    const d = distance(normalized_name, normalizeName(row.name));
    if (d < bestDist) {
      bestDist = d;
      bestId = row.id;
      bestName = row.name;
    }
  }

  if (rows.length === 0 || bestDist > 6) {
    return { matched: false, ingredient_id: null, matched_name: null, flag_reason: 'no_match' };
  }
  if (bestDist <= 3) {
    return { matched: true, ingredient_id: bestId, matched_name: bestName };
  }
  return { matched: 'partial', ingredient_id: bestId, matched_name: bestName, flag_reason: 'low_confidence_match' };
};

module.exports = { matchToIngredient };
