const KEY = 'smp_prefs';

const DEFAULTS = {
  restaurantName: '',
  ownerName: '',
  location: '',
  alertThresholdDays: 7,
  defaultPriceSource: 'latest',
  theme: 'bistro',
  brandIcon: 'fork',
  brandIconCustom: '',
  priceGapThreshold: 15,
  foodCostDeviationThreshold: 5,
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  window.dispatchEvent(new CustomEvent('smp:prefs-updated'));
}
