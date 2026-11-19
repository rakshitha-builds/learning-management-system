import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Inbox, Loader2, Search, X, XCircle } from 'lucide-react';
import { removeToast } from '../app/uiSlice';

export const cx = (...c) => c.filter(Boolean).join(' ');

const variants = {
  primary: 'bg-accent text-white hover:brightness-110 shadow-sm',
  secondary: 'bg-white text-ink border border-stone-300 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  soft: 'bg-accent-soft text-accent-ink hover:brightness-95',
};
export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button disabled={disabled || loading} className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50', variants[variant], sizes[size], className)} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}{children}
    </button>
  );
}

export function Field({ label, error, hint, children, className }) {
  return (
    <div className={cx('block', className)}>
      <label className="block">
        {label && <span className="mb-1.5 block text-sm font-semibold text-stone-700">{label}</span>}
        {children}
      </label>
      {error ? <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
    </div>
  );
}
const inputCls = (error) => cx('w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2', error ? 'border-rose-400 focus:ring-rose-200' : 'border-stone-300 focus:border-accent focus:ring-accent/20');
export const Input = ({ label, error, hint, className, ...p }) => <Field label={label} error={error} hint={hint} className={className}><input className={inputCls(error)} {...p} /></Field>;
export const Textarea = ({ label, error, hint, className, ...p }) => <Field label={label} error={error} hint={hint} className={className}><textarea rows={4} className={inputCls(error)} {...p} /></Field>;
export const Select = ({ label, error, hint, className, children, ...p }) => <Field label={label} error={error} hint={hint} className={className}><select className={inputCls(error)} {...p}>{children}</select></Field>;

export const Card = ({ className, children, ...p }) => <div className={cx('rounded-2xl border border-stone-200/80 bg-white shadow-card', className)} {...p}>{children}</div>;

const tones = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200', red: 'bg-rose-50 text-rose-700 ring-rose-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', gray: 'bg-stone-100 text-stone-600 ring-stone-200', accent: 'bg-accent-soft text-accent-ink ring-accent/20' };
export const Badge = ({ tone = 'gray', children, className }) => <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>{children}</span>;
const statusTone = { success: 'green', ready: 'green', approved: 'green', active: 'green', completed: 'green', live: 'red', pending: 'amber', processing: 'amber', queued: 'blue', scheduled: 'blue', uploaded: 'blue', draft: 'gray', ended: 'gray', failed: 'red', rejected: 'red', suspended: 'red', cancelled: 'gray' };
export const StatusBadge = ({ status }) => <Badge tone={statusTone[status] || 'gray'}>{status === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}{status}</Badge>;

export function StatCard({ icon: Icon, label, value, hint, tone = 'accent' }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-stone-500">{label}</p><p className="mt-2 font-display text-3xl font-semibold">{value}</p></div>
        {Icon && <span className={cx('grid h-10 w-10 place-items-center rounded-xl', tone === 'accent' ? 'bg-accent-soft text-accent-ink' : tones[tone])}><Icon className="h-5 w-5" /></span>}
      </div>
      {hint && <p className="mt-3 text-xs text-stone-500">{hint}</p>}
    </Card>
  );
}

export const Spinner = ({ className }) => <Loader2 className={cx('h-5 w-5 animate-spin text-accent', className)} />;
export const Skeleton = ({ className }) => <div className={cx('skeleton rounded-lg', className)} />;
export const PageLoader = () => <div className="grid min-h-[40vh] place-items-center"><Spinner className="h-8 w-8" /></div>;

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-stone-100 text-stone-400"><Icon className="h-6 w-6" /></span>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-stone-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ error, retry }) {
  const msg = error?.data?.message || error?.message || 'Something went wrong while loading this page.';
  return (
    <div className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
      <XCircle className="h-8 w-8 text-rose-500" />
      <h3 className="mt-3 font-display text-lg font-semibold text-rose-800">Couldn’t load this</h3>
      <p className="mt-1 max-w-md text-sm text-rose-700">{error?.status === 'FETCH_ERROR' ? 'Cannot reach the server. Is the backend running?' : msg}</p>
      {retry && <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>Try again</Button>}
    </div>
  );
}
// One-liner for RTK Query results: loading / error / empty / content.
export function Async({ q, empty, children, skeleton }) {
  if (q.isLoading) return skeleton || <PageLoader />;
  if (q.isError) return <ErrorState error={q.error} retry={q.refetch} />;
  const data = q.data?.items ?? q.data;
  if (empty && (!data || (Array.isArray(data) && data.length === 0))) return empty;
  return children(q.data);
}

export function Modal({ open, onClose, title, children, wide, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('fade-in flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'max-w-3xl' : 'max-w-lg')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><h2 className="font-display text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button></div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-stone-600">{message}</p>
    </Modal>
  );
}

export function ProgressBar({ value = 0, className, tone }) {
  return (
    <div className={cx('h-2 w-full overflow-hidden rounded-full bg-stone-200', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', tone || 'bg-accent')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-stone-200 scrollbar-thin" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cx('whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition', value === t.id ? 'border-accent text-accent-ink' : 'border-transparent text-stone-500 hover:text-ink')}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>{subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
    </div>
  );
}

// Debounced value for server-side search boxes.
export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 text-sm text-stone-500">
      <span>Page {meta.page} of {meta.pages} · {meta.total} total</span>
      <div className="flex gap-1">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/**
 * Responsive table. Pass `toolbar` for search/filters, `meta`+`onPage` for server pagination,
 * or `clientSearch` (a row -> string function) for in-browser search of already-loaded rows.
 */
export function DataTable({ columns, rows = [], loading, error, toolbar, meta, onPage, clientSearch, emptyTitle = 'Nothing here yet', emptyMessage, dense }) {
  const [q, setQ] = useState('');
  const shown = clientSearch && q ? rows.filter((r) => clientSearch(r).toLowerCase().includes(q.toLowerCase())) : rows;
  return (
    <Card className="overflow-hidden">
      {(toolbar || clientSearch) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 p-4">
          {clientSearch && <SearchBox value={q} onChange={setQ} className="w-full sm:w-64" />}
          {toolbar}
        </div>
      )}
      {error ? <div className="p-6"><ErrorState error={error} /></div> : (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-500">
              <tr>{columns.map((c) => <th key={c.key} className={cx('px-4 font-semibold', dense ? 'py-2' : 'py-3', c.className)}>{c.header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? Array.from({ length: 5 }).map((_, i) => <tr key={i}>{columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>)
                : shown.map((r, i) => <tr key={r._id || r.id || i} className="hover:bg-stone-50/60">{columns.map((c) => <td key={c.key} className={cx('px-4', dense ? 'py-2' : 'py-3', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}
            </tbody>
          </table>
          {!loading && shown.length === 0 && <div className="p-6"><EmptyState title={emptyTitle} message={emptyMessage} /></div>}
        </div>
      )}
      {meta && onPage && <Pagination meta={meta} onPage={onPage} />}
    </Card>
  );
}

const toastIcon = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const toastTone = { success: 'border-emerald-200 text-emerald-700', error: 'border-rose-200 text-rose-700', info: 'border-sky-200 text-sky-700', warning: 'border-amber-200 text-amber-700' };
function Toast({ t }) {
  const dispatch = useDispatch();
  useEffect(() => { const id = setTimeout(() => dispatch(removeToast(t.id)), 4500); return () => clearTimeout(id); }, [t.id, dispatch]);
  const Icon = toastIcon[t.type] || Info;
  return (
    <div role="status" className={cx('fade-in pointer-events-auto flex w-80 max-w-[92vw] items-start gap-3 rounded-xl border bg-white p-4 shadow-lg', toastTone[t.type])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" /><p className="flex-1 text-sm font-medium text-ink">{t.message}</p>
      <button onClick={() => dispatch(removeToast(t.id))} aria-label="Dismiss" className="text-stone-400 hover:text-ink"><X className="h-4 w-4" /></button>
    </div>
  );
}
export function ToastHost() {
  const toasts = useSelector((s) => s.ui.toasts);
  return <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">{toasts.map((t) => <Toast key={t.id} t={t} />)}</div>;
}
