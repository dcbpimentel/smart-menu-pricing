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
  const [rows] = await db.query('SELECT id, name, unit FROM ingredients');

  let best = null;
  let bestDist = Infinity;

  for (const row of rows) {
    const d = distance(normalized_name, normalizeName(row.name));
    if (d < bestDist) {
      bestDist = d;
      best = row;
    }
  }

  if (rows.length === 0 || bestDist > 6) {
    return { matched: false, ingredient_id: null, matched_name: null, ingredient_unit: null, flag_reason: 'no_match' };
  }
  // 3 edits is a typo in "chicken breast" but a different word in "melon" vs "onion",
  // so a full match also needs the edits to be at most a quarter of the name's length.
  const longest = Math.max(normalized_name.length, normalizeName(best.name).length);
  if (bestDist <= 3 && bestDist <= longest * 0.25) {
    return { matched: true, ingredient_id: best.id, matched_name: best.name, ingredient_unit: best.unit };
  }
  return { matched: 'partial', ingredient_id: best.id, matched_name: best.name, ingredient_unit: best.unit, flag_reason: 'low_confidence_match' };
};

module.exports = { matchToIngredient };
