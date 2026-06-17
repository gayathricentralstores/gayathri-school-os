export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function initials(name) {
  const cleaned = String(name || 'Student').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || 'S') + (parts[1]?.[0] || '');
}

export function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('paid') || value.includes('active') || value.includes('ready') || value.includes('sent')) return 'secure';
  if (value.includes('pending') || value.includes('partial') || value.includes('draft')) return 'warm';
  if (value.includes('overdue') || value.includes('failed') || value.includes('absent')) return 'danger';
  return '';
}

export function buildClassName(...items) {
  return items.filter(Boolean).join(' ');
}
