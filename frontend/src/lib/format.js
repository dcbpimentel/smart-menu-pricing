const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₱0.00';
  return pesoFormatter.format(Number(amount));
}

export function formatPct(value, decimals = 1) {
  if (value == null || isNaN(value)) return '0.0%';
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-PH').format(value);
}
