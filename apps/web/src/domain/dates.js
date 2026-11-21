export function dateKey(date = new Date()) {
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid date');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const value = new Date(`${key}T12:00:00`);
  return !Number.isNaN(value.getTime()) && dateKey(value) === key;
}

export function parseDate(key) {
  if (!isDateKey(key)) throw new RangeError(`Invalid date key: ${key}`);
  return new Date(`${key}T12:00:00`);
}

export function dayAgo(days, from = new Date()) {
  const value = new Date(from);
  value.setDate(value.getDate() - days);
  return dateKey(value);
}

export function shortDate(key) {
  return parseDate(key).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}
