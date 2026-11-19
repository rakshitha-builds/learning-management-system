export const inr = (paise, { minor = true } = {}) => {
  const v = minor ? (paise || 0) / 100 : paise || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
};
export const price = (p) => (p > 0 ? inr(p, { minor: false }) : 'Free');
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const duration = (sec = 0) => {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m || (sec ? 1 : 0)} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
export const clock = (sec = 0) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
export const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
export const errMsg = (e) => e?.data?.details?.[0] ? `${e.data.details[0].message}` : e?.data?.message || e?.message || 'Something went wrong';
export const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
